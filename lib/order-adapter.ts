import { eventForStatus, products, type Order, type OrderStatus } from "./order-domain";

export type ServerOrderRecord = {
  id: number;
  publicId: string;
  state: string;
  lines: Array<{ productId: string; quantity: number; unitPrice: number }>;
  subtotal: number | string;
  deliveryFee: number | string;
  total: number | string;
  address: string;
  paymentMethod: string;
  createdAt: Date | string;
};

export function serverOrderToClientOrder(record: ServerOrderRecord, previous?: Order): Order {
  const status = record.state as OrderStatus;
  const order: Order = {
    id: String(record.id),
    displayId: record.publicId,
    createdAt: new Date(record.createdAt).toISOString(),
    status,
    lines: record.lines.map((line) => {
      const product = products.find((item) => item.id === line.productId) ?? products[0];
      return { ...product, quantity: line.quantity, price: Number(line.unitPrice) };
    }),
    subtotal: Number(record.subtotal),
    deliveryFee: Number(record.deliveryFee),
    total: Number(record.total),
    address: record.address,
    paymentMethod: previous?.paymentMethod ?? "Visa ending 4242",
    rider: previous?.rider,
    events: previous?.events ?? [],
  };
  const nextEvent = eventForStatus(status, order);
  if (!nextEvent || order.events.some((event) => event.status === status)) return order;
  return { ...order, events: [nextEvent, ...order.events] };
}
