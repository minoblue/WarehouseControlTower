import {
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  Body,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { Response } from 'express';
import type { AuthenticatedUser } from '../common/authenticated-user.js';
import { CurrentUser } from '../common/current-user.decorator.js';
import { Roles } from '../common/roles.decorator.js';
import { CreateOrderDto, ListOrdersQueryDto } from './order.dto.js';
import { OrdersService } from './orders.service.js';

@Controller('orders')
export class OrdersController {
  public constructor(private readonly orders: OrdersService) {}

  @Get()
  public list(@Query() query: ListOrdersQueryDto): Promise<unknown> {
    return this.orders.list(query);
  }

  @Post()
  @HttpCode(202)
  @Roles(UserRole.OPERATIONS, UserRole.SUPPORT_ENGINEER, UserRole.ADMIN)
  public async create(
    @Body() input: CreateOrderDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ): Promise<unknown> {
    const result = await this.orders.create(
      input,
      idempotencyKey,
      user,
      String(response.locals.correlationId),
    );
    response.setHeader('Idempotent-Replayed', String(result.replayed));
    return { data: result.data, meta: { correlationId: result.data.correlationId } };
  }

  @Get(':id')
  public get(@Param('id', new ParseUUIDPipe()) id: string): Promise<unknown> {
    return this.orders.get(id);
  }
}
