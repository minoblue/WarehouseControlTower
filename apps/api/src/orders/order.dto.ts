import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateOrderItemDto {
  @IsString()
  @Length(1, 64)
  public sku!: string;

  @IsInt()
  @Min(1)
  @Max(100_000)
  public quantity!: number;
}

export class CreateOrderDto {
  @IsString()
  @Length(1, 100)
  public customerId!: string;

  @IsString()
  @Length(1, 120)
  public customerReference!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  public items!: CreateOrderItemDto[];
}

export class ListOrdersQueryDto {
  @IsString()
  @MaxLength(40)
  public status?: string;

  @IsString()
  @MaxLength(100)
  public customerId?: string;

  @IsString()
  @MaxLength(100)
  public cursor?: string;
}
