export type OrderStatus =
  | "ORDER_CREATED"
  | "INVENTORY_CHECK_PENDING"
  | "INVENTORY_RESERVED"
  | "PAYMENT_PENDING"
  | "PAYMENT_CONFIRMED"
  | "RIDER_ASSIGNMENT_PENDING"
  | "RIDER_ASSIGNED"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "CANCELLED"
  | "FAILED";

export type ServiceName =
  | "Order Service"
  | "Inventory Service"
  | "Payment Service"
  | "Dispatch Service"
  | "Notification Engine";

export type Product = {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  unit: string;
  accent: string;
};

export type CartLine = Product & { quantity: number };

export type OrderEvent = {
  id: string;
  type: string;
  service: ServiceName;
  status: OrderStatus;
  message: string;
  occurredAt: string;
};

export type RiderAssignment = {
  name: string;
  initials: string;
  vehicle: string;
  eta: string;
  phone: string;
};

export type Order = {
  id: string;
  displayId: string;
  createdAt: string;
  status: OrderStatus;
  lines: CartLine[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  address: string;
  paymentMethod: string;
  rider?: RiderAssignment;
  events: OrderEvent[];
};

export const products: Product[] = [
  {
    id: "p-avocado",
    name: "Garden Avocados",
    description: "Creamy, ripe and ready for toast.",
    category: "Fresh picks",
    price: 6.5,
    unit: "3 pack",
    accent: "#DDEFD9",
  },
  {
    id: "p-bread",
    name: "Sourdough Loaf",
    description: "Slow-fermented with a crisp crust.",
    category: "Bakery",
    price: 5.25,
    unit: "650 g",
    accent: "#F7E5C5",
  },
  {
    id: "p-berries",
    name: "Berry Breakfast Box",
    description: "Strawberries, blueberries and raspberries.",
    category: "Fresh picks",
    price: 8.75,
    unit: "400 g",
    accent: "#F3D7E2",
  },
  {
    id: "p-coffee",
    name: "House Roast Coffee",
    description: "Bright, balanced beans for slow mornings.",
    category: "Pantry",
    price: 12.0,
    unit: "250 g",
    accent: "#E9D7C1",
  },
  {
    id: "p-milk",
    name: "Oat Milk",
    description: "Barista-style and softly textured.",
    category: "Chilled",
    price: 4.8,
    unit: "1 L",
    accent: "#E8E5D4",
  },
  {
    id: "p-granola",
    name: "Honey Granola",
    description: "Toasted oats, almonds and orange blossom.",
    category: "Pantry",
    price: 7.2,
    unit: "350 g",
    accent: "#F4DDBB",
  },
];

export const initialOrder: Order = {
  id: "order-demo-001",
  displayId: "RO-240829-001",
  createdAt: "2026-08-29T17:28:00.000Z",
  status: "OUT_FOR_DELIVERY",
  lines: [
    { ...products[0], quantity: 1 },
    { ...products[1], quantity: 1 },
    { ...products[3], quantity: 1 },
  ],
  subtotal: 23.75,
  deliveryFee: 2.5,
  total: 26.25,
  address: "18 Cedar Lane, Apt 4B",
  paymentMethod: "Visa ending 4242",
  rider: {
    name: "Maya Okafor",
    initials: "MO",
    vehicle: "Blue bicycle",
    eta: "12–18 min",
    phone: "+1 555 014 0288",
  },
  events: [
    {
      id: "evt-7",
      type: "DeliveryStarted",
      service: "Dispatch Service",
      status: "OUT_FOR_DELIVERY",
      message: "Maya accepted the delivery and is on the way.",
      occurredAt: "2026-08-29T17:49:00.000Z",
    },
    {
      id: "evt-6",
      type: "RiderAssigned",
      service: "Dispatch Service",
      status: "RIDER_ASSIGNED",
      message: "Maya was assigned to the order.",
      occurredAt: "2026-08-29T17:46:00.000Z",
    },
    {
      id: "evt-5",
      type: "PaymentConfirmed",
      service: "Payment Service",
      status: "PAYMENT_CONFIRMED",
      message: "Payment authorization succeeded.",
      occurredAt: "2026-08-29T17:43:00.000Z",
    },
    {
      id: "evt-4",
      type: "InventoryReserved",
      service: "Inventory Service",
      status: "INVENTORY_RESERVED",
      message: "All 3 items were reserved from Cedar Market.",
      occurredAt: "2026-08-29T17:42:00.000Z",
    },
    {
      id: "evt-3",
      type: "InventoryCheckPassed",
      service: "Inventory Service",
      status: "INVENTORY_CHECK_PENDING",
      message: "Availability verified for each line item.",
      occurredAt: "2026-08-29T17:41:00.000Z",
    },
    {
      id: "evt-2",
      type: "OrderPlaced",
      service: "Order Service",
      status: "ORDER_CREATED",
      message: "Order persisted and published to the event bus.",
      occurredAt: "2026-08-29T17:40:00.000Z",
    },
  ],
};

export const lifecycle: Array<{
  status: OrderStatus;
  label: string;
  service: ServiceName;
  type: string;
}> = [
  { status: "ORDER_CREATED", label: "Order placed", service: "Order Service", type: "OrderPlaced" },
  { status: "INVENTORY_RESERVED", label: "Inventory reserved", service: "Inventory Service", type: "InventoryReserved" },
  { status: "PAYMENT_CONFIRMED", label: "Payment confirmed", service: "Payment Service", type: "PaymentConfirmed" },
  { status: "RIDER_ASSIGNED", label: "Rider assigned", service: "Dispatch Service", type: "RiderAssigned" },
  { status: "OUT_FOR_DELIVERY", label: "Out for delivery", service: "Dispatch Service", type: "DeliveryStarted" },
  { status: "DELIVERED", label: "Delivered", service: "Order Service", type: "DeliveryConfirmed" },
];

export const statusLabel: Record<OrderStatus, string> = {
  ORDER_CREATED: "Order placed",
  INVENTORY_CHECK_PENDING: "Checking inventory",
  INVENTORY_RESERVED: "Inventory reserved",
  PAYMENT_PENDING: "Payment pending",
  PAYMENT_CONFIRMED: "Payment confirmed",
  RIDER_ASSIGNMENT_PENDING: "Finding a rider",
  RIDER_ASSIGNED: "Rider assigned",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  FAILED: "Needs attention",
};

export const money = (value: number) => `$${value.toFixed(2)}`;

export function nextLifecycleStatus(status: OrderStatus): OrderStatus | null {
  const index = lifecycle.findIndex((item) => item.status === status);
  if (index < 0 || index === lifecycle.length - 1) return null;
  return lifecycle[index + 1].status;
}

export function eventForStatus(status: OrderStatus, order: Order): OrderEvent | null {
  const step = lifecycle.find((item) => item.status === status);
  if (!step) return null;
  const messages: Record<OrderStatus, string> = {
    ORDER_CREATED: "Order persisted and published to the event bus.",
    INVENTORY_RESERVED: `All ${order.lines.length} items were reserved from Cedar Market.`,
    PAYMENT_CONFIRMED: "Payment authorization succeeded.",
    RIDER_ASSIGNED: "Maya was assigned to the order.",
    OUT_FOR_DELIVERY: "Maya accepted the delivery and is on the way.",
    DELIVERED: "Delivery confirmation received from the rider.",
    INVENTORY_CHECK_PENDING: "Availability verified for each line item.",
    PAYMENT_PENDING: "Payment authorization is being processed.",
    RIDER_ASSIGNMENT_PENDING: "Dispatch is searching for the nearest available rider.",
    CANCELLED: "Order cancellation was recorded.",
    FAILED: "A workflow step requires attention.",
  };
  return {
    id: `evt-${Date.now()}`,
    type: step.type,
    service: step.service,
    status,
    message: messages[status],
    occurredAt: new Date().toISOString(),
  };
}
