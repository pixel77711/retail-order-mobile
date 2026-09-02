import { describe, expect, it } from "vitest";

import { serverOrderToClientOrder } from "../lib/order-adapter";
import { nextOrderState } from "../server/retail-service";

describe("production order contracts", () => {
  it("allows only the intended fulfillment progression", () => {
    expect(nextOrderState("ORDER_CREATED")).toBe("INVENTORY_RESERVED");
    expect(nextOrderState("INVENTORY_RESERVED")).toBe("PAYMENT_CONFIRMED");
    expect(nextOrderState("PAYMENT_CONFIRMED")).toBe("RIDER_ASSIGNED");
    expect(nextOrderState("RIDER_ASSIGNED")).toBe("OUT_FOR_DELIVERY");
    expect(nextOrderState("OUT_FOR_DELIVERY")).toBe("DELIVERED");
    expect(nextOrderState("DELIVERED")).toBeNull();
    expect(nextOrderState("CANCELLED")).toBeNull();
  });

  it("maps authoritative server totals and lines into the mobile projection", () => {
    const order = serverOrderToClientOrder({
      id: 42,
      publicId: "RO-20260902-101",
      state: "ORDER_CREATED",
      lines: [{ productId: "p-coffee", quantity: 2, unitPrice: 12 }],
      subtotal: "24.00",
      deliveryFee: "2.50",
      total: "26.50",
      address: "18 Cedar Lane, Apt 4B",
      paymentMethod: "pm_demo_visa_4242",
      createdAt: "2026-09-02T16:00:00.000Z",
    });

    expect(order.id).toBe("42");
    expect(order.displayId).toBe("RO-20260902-101");
    expect(order.lines[0]?.name).toBe("House Roast Coffee");
    expect(order.total).toBe(26.5);
    expect(order.events).toHaveLength(1);
  });
});
