import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import {
  eventForStatus,
  initialOrder,
  nextLifecycleStatus,
  products,
  type CartLine,
  type Order,
  type OrderStatus,
  type Product,
} from "@/lib/order-domain";

const STORAGE_KEY = "retail-order-mobile-state";

type OrderStoreValue = {
  cart: CartLine[];
  activeOrder: Order;
  orders: Order[];
  addToCart: (product: Product) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  placeOrder: () => Order;
  advanceOrder: () => void;
  confirmDelivery: () => void;
  resetDemo: () => void;
};

const demoCart: CartLine[] = [
  { ...products[0], quantity: 1 },
  { ...products[1], quantity: 1 },
];

const initialState = {
  cart: demoCart,
  activeOrder: initialOrder,
  orders: [initialOrder],
};

const OrderStoreContext = createContext<OrderStoreValue | null>(null);

function buildOrder(lines: CartLine[]): Order {
  const subtotal = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const deliveryFee = subtotal >= 30 ? 0 : 2.5;
  const now = new Date();
  const order: Order = {
    id: `order-${Date.now()}`,
    displayId: `RO-${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(Math.floor(Math.random() * 900) + 100)}`,
    createdAt: now.toISOString(),
    status: "ORDER_CREATED",
    lines,
    subtotal,
    deliveryFee,
    total: subtotal + deliveryFee,
    address: "18 Cedar Lane, Apt 4B",
    paymentMethod: "Visa ending 4242",
    events: [],
  };
  const event = eventForStatus("ORDER_CREATED", order);
  return event ? { ...order, events: [event] } : order;
}

export function OrderProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartLine[]>(initialState.cart);
  const [activeOrder, setActiveOrder] = useState<Order>(initialState.activeOrder);
  const [orders, setOrders] = useState<Order[]>(initialState.orders);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (!saved) return;
      try {
        const parsed = JSON.parse(saved) as typeof initialState;
        if (parsed.cart && parsed.activeOrder && parsed.orders) {
          setCart(parsed.cart);
          setActiveOrder(parsed.activeOrder);
          setOrders(parsed.orders);
        }
      } catch {
        // Ignore malformed local state and keep the deterministic demo state.
      }
    });
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ cart, activeOrder, orders })).catch(() => undefined);
  }, [cart, activeOrder, orders]);

  const value = useMemo<OrderStoreValue>(() => {
    const updateOrder = (order: Order) => {
      setActiveOrder(order);
      setOrders((current) => [order, ...current.filter((item) => item.id !== order.id)]);
    };

    return {
      cart,
      activeOrder,
      orders,
      addToCart: (product) => {
        setCart((current) => {
          const exists = current.find((line) => line.id === product.id);
          if (exists) return current.map((line) => line.id === product.id ? { ...line, quantity: line.quantity + 1 } : line);
          return [...current, { ...product, quantity: 1 }];
        });
      },
      updateQuantity: (productId, quantity) => {
        setCart((current) => current.flatMap((line) => line.id === productId ? (quantity > 0 ? [{ ...line, quantity }] : []) : [line]));
      },
      clearCart: () => setCart([]),
      placeOrder: () => {
        const nextOrder = buildOrder(cart.length ? cart : demoCart);
        setCart([]);
        updateOrder(nextOrder);
        return nextOrder;
      },
      advanceOrder: () => {
        const nextStatus = nextLifecycleStatus(activeOrder.status);
        if (!nextStatus) return;
        const nextEvent = eventForStatus(nextStatus, activeOrder);
        const nextOrder: Order = {
          ...activeOrder,
          status: nextStatus,
          rider: nextStatus === "RIDER_ASSIGNED" || nextStatus === "OUT_FOR_DELIVERY" || nextStatus === "DELIVERED"
            ? activeOrder.rider ?? {
                name: "Maya Okafor",
                initials: "MO",
                vehicle: "Blue bicycle",
                eta: "12–18 min",
                phone: "+1 555 014 0288",
              }
            : activeOrder.rider,
          events: nextEvent ? [nextEvent, ...activeOrder.events] : activeOrder.events,
        };
        updateOrder(nextOrder);
      },
      confirmDelivery: () => {
        if (activeOrder.status !== "OUT_FOR_DELIVERY") return;
        const nextEvent = eventForStatus("DELIVERED", activeOrder);
        if (!nextEvent) return;
        updateOrder({ ...activeOrder, status: "DELIVERED", events: [nextEvent, ...activeOrder.events] });
      },
      resetDemo: () => {
        setCart(initialState.cart);
        setActiveOrder(initialState.activeOrder);
        setOrders(initialState.orders);
      },
    };
  }, [activeOrder, cart, orders]);

  return <OrderStoreContext.Provider value={value}>{children}</OrderStoreContext.Provider>;
}

export function useOrderStore() {
  const value = useContext(OrderStoreContext);
  if (!value) throw new Error("useOrderStore must be used inside OrderProvider");
  return value;
}

export function statusProgress(status: OrderStatus) {
  const steps: OrderStatus[] = ["ORDER_CREATED", "INVENTORY_RESERVED", "PAYMENT_CONFIRMED", "RIDER_ASSIGNED", "OUT_FOR_DELIVERY", "DELIVERED"];
  const index = steps.indexOf(status);
  return index < 0 ? 0 : (index + 1) / steps.length;
}
