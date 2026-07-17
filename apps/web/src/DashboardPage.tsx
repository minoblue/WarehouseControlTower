import { useCallback, useMemo, useState, type SyntheticEvent } from 'react';
import {
  Button,
  Column,
  DataTable,
  Grid,
  InlineLoading,
  InlineNotification,
  NumberInput,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
  TextInput,
  Tile,
} from '@carbon/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api.js';
import { useOrderUpdates } from './useOrderUpdates.js';

const statusKind = (status: string): 'green' | 'red' | 'blue' | 'gray' | 'warm-gray' => {
  if (status === 'DISPATCHED' || status === 'DELIVERED') return 'green';
  if (status.includes('FAILED') || status === 'MANUAL_REVIEW') return 'red';
  if (status === 'RECEIVED' || status === 'VALIDATING') return 'blue';
  if (status === 'CANCELLED') return 'gray';
  return 'warm-gray';
};

const headers = [
  { key: 'customerReference', header: 'Reference' },
  { key: 'status', header: 'Status' },
  { key: 'items', header: 'Units' },
  { key: 'correlationId', header: 'Correlation ID' },
  { key: 'createdAt', header: 'Received' },
];

export const DashboardPage = (): React.ReactNode => {
  const client = useQueryClient();
  const liveConnected = useOrderUpdates();
  const ordersQuery = useQuery({
    queryKey: ['orders'],
    queryFn: api.orders,
    refetchInterval: 5000,
  });
  const [customerId, setCustomerId] = useState('retail-colombo-07');
  const [reference, setReference] = useState('PO-2026-1042');
  const [sku, setSku] = useState('PALLET-STD');
  const [quantity, setQuantity] = useState(2);
  const mutation = useMutation({
    mutationFn: api.createOrder,
    onSuccess: async () => client.invalidateQueries({ queryKey: ['orders'] }),
  });
  const orders = ordersQuery.data?.data ?? [];
  const metrics = useMemo(() => {
    const processing = orders.filter((order) =>
      ['RECEIVED', 'VALIDATING', 'INVENTORY_ALLOCATED', 'READY_FOR_PICKING'].includes(order.status),
    ).length;
    return {
      received: orders.length,
      processing,
      completed: orders.filter((order) => ['DISPATCHED', 'DELIVERED'].includes(order.status))
        .length,
      failed: orders.filter(
        (order) => order.status.includes('FAILED') || order.status === 'MANUAL_REVIEW',
      ).length,
    };
  }, [orders]);
  const rows = useMemo(
    () =>
      orders.map((order) => ({
        id: order.id,
        customerReference: order.customerReference,
        status: order.status,
        items: String(order.items.reduce((total, item) => total + item.quantity, 0)),
        correlationId: order.correlationId,
        createdAt: new Intl.DateTimeFormat(undefined, {
          dateStyle: 'medium',
          timeStyle: 'short',
        }).format(new Date(order.createdAt)),
      })),
    [orders],
  );

  const submit = useCallback(
    (event: SyntheticEvent<HTMLFormElement>): void => {
      event.preventDefault();
      mutation.mutate({
        customerId,
        customerReference: reference,
        items: [{ sku, quantity }],
      });
    },
    [customerId, reference, sku, quantity, mutation],
  );

  return (
    <div className="dashboard-page">
      <header className="page-heading">
        <div>
          <p>Live operations</p>
          <h1>Warehouse overview</h1>
        </div>
        <span className="refresh-note">
          {liveConnected ? 'Live updates connected' : 'Reconnecting; polling every 5 seconds'}
        </span>
      </header>

      <Grid fullWidth className="metric-grid">
        {Object.entries(metrics).map(([key, value]) => (
          <Column sm={2} md={2} lg={4} key={key}>
            <Tile className="metric-tile">
              <span>{key}</span>
              <strong>{value}</strong>
            </Tile>
          </Column>
        ))}
      </Grid>

      <Grid fullWidth className="workspace-grid">
        <Column sm={4} md={5} lg={11}>
          <section aria-labelledby="orders-title">
            {ordersQuery.isError ? (
              <InlineNotification
                kind="error"
                title="Orders unavailable"
                subtitle={ordersQuery.error.message}
                hideCloseButton
              />
            ) : null}
            {ordersQuery.isPending ? <InlineLoading description="Loading orders" /> : null}
            {!ordersQuery.isPending && orders.length === 0 ? (
              <div className="empty-state">
                <h2 id="orders-title">No orders yet</h2>
                <p>Create the first order to start the event-driven workflow.</p>
              </div>
            ) : (
              <DataTable rows={rows} headers={headers}>
                {({ rows: tableRows, headers: tableHeaders, getTableProps, getRowProps }) => (
                  <TableContainer
                    title="Recent orders"
                    description="Newest warehouse orders and processing state."
                  >
                    <Table {...getTableProps()}>
                      <TableHead>
                        <TableRow>
                          {tableHeaders.map((header) => (
                            <TableHeader key={header.key}>{header.header}</TableHeader>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {tableRows.map((row) => (
                          <TableRow {...getRowProps({ row })} key={row.id}>
                            {row.cells.map((cell) => (
                              <TableCell key={cell.id}>
                                {cell.info.header === 'status' ? (
                                  <Tag type={statusKind(String(cell.value))}>
                                    {String(cell.value).replaceAll('_', ' ')}
                                  </Tag>
                                ) : cell.info.header === 'correlationId' ? (
                                  <code>{String(cell.value).slice(0, 8)}</code>
                                ) : (
                                  String(cell.value)
                                )}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </DataTable>
            )}
          </section>
        </Column>

        <Column sm={4} md={3} lg={5}>
          <aside className="create-panel" aria-labelledby="create-order-title">
            <h2 id="create-order-title">Create order</h2>
            <p>Submit one inventory line to the asynchronous processing queue.</p>
            {mutation.isError ? (
              <InlineNotification
                kind="error"
                title="Order not created"
                subtitle={mutation.error.message}
                hideCloseButton
              />
            ) : null}
            {mutation.isSuccess ? (
              <InlineNotification
                kind="success"
                title="Order accepted"
                subtitle={`Correlation ${mutation.data.data.correlationId.slice(0, 8)}`}
                hideCloseButton
              />
            ) : null}
            <form onSubmit={submit}>
              <TextInput
                id="customer-id"
                labelText="Customer ID"
                value={customerId}
                onChange={(e) => {
                  setCustomerId(e.currentTarget.value);
                }}
                required
              />
              <TextInput
                id="reference"
                labelText="Customer reference"
                value={reference}
                onChange={(e) => {
                  setReference(e.currentTarget.value);
                }}
                required
              />
              <TextInput
                id="sku"
                labelText="SKU"
                value={sku}
                onChange={(e) => {
                  setSku(e.currentTarget.value.toUpperCase());
                }}
                required
              />
              <NumberInput
                id="quantity"
                label="Quantity"
                min={1}
                max={100000}
                value={quantity}
                onChange={(_event, state) => {
                  setQuantity(Number(state.value));
                }}
              />
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Submitting...' : 'Create order'}
              </Button>
            </form>
          </aside>
        </Column>
      </Grid>
    </div>
  );
};
