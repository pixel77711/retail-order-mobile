import { and, asc, eq, inArray } from "drizzle-orm";

import {
  backorderSubscriptions,
  inventoryItems,
  notificationOutbox,
  orderEvents,
  orders,
  restockEventInbox,
  type BackorderSubscription as DbBackorderSubscription,
  type Order as DbOrder,
} from "../drizzle/schema";
import { getDb } from "./db";

export const ORDER_STATES = [
  "ORDER_CREATED",
  "INVENTORY_RESERVED",
  "PAYMENT_CONFIRMED",
  "RIDER_ASSIGNED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
  "FAILED",
] as const;
export type OrderState = (typeof ORDER_STATES)[number];
export type Channel = "PUSH" | "EMAIL" | "SMS";

const nextState: Partial<Record<OrderState, OrderState>> = {
  ORDER_CREATED: "INVENTORY_RESERVED",
  INVENTORY_RESERVED: "PAYMENT_CONFIRMED",
  PAYMENT_CONFIRMED: "RIDER_ASSIGNED",
  RIDER_ASSIGNED: "OUT_FOR_DELIVERY",
  OUT_FOR_DELIVERY: "DELIVERED",
};

const eventForState: Partial<Record<OrderState, string>> = {
  ORDER_CREATED: "OrderPlaced",
  INVENTORY_RESERVED: "InventoryReserved",
  PAYMENT_CONFIRMED: "PaymentConfirmed",
  RIDER_ASSIGNED: "RiderAssigned",
  OUT_FOR_DELIVERY: "DeliveryStarted",
  DELIVERED: "DeliveryConfirmed",
};

function money(value: number) {
  return Number(value.toFixed(2));
}

function normalizeOrder(row: DbOrder) {
  return {
    ...row,
    lines: JSON.parse(row.linesJson) as Array<{ productId: string; quantity: number; unitPrice: number }>,
    subtotal: Number(row.subtotal),
    deliveryFee: Number(row.deliveryFee),
    total: Number(row.total),
  };
}

function queueForChannel(channel: Channel) {
  return channel === "PUSH" ? "notifications:push" : channel === "EMAIL" ? "notifications:email" : "notifications:sms";
}

export async function listOrdersForUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const rows = await db.select().from(orders).where(eq(orders.userId, userId)).orderBy(asc(orders.createdAt));
  return rows.map(normalizeOrder);
}

export async function getOrderForUser(userId: number, publicId: string) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const rows = await db.select().from(orders).where(and(eq(orders.userId, userId), eq(orders.publicId, publicId))).limit(1);
  return rows[0] ? normalizeOrder(rows[0]) : null;
}

export async function createOrder(input: {
  userId: number;
  idempotencyKey: string;
  lines: Array<{ productId: string; quantity: number; unitPrice: number }>;
  address: string;
  paymentMethod: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");

  const existing = await db.select().from(orders).where(eq(orders.idempotencyKey, input.idempotencyKey)).limit(1);
  if (existing[0]) {
    if (existing[0].userId !== input.userId) throw new Error("IDEMPOTENCY_KEY_CONFLICT");
    return normalizeOrder(existing[0]);
  }

  const subtotal = money(input.lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0));
  const deliveryFee = subtotal >= 30 ? 0 : 2.5;
  const total = money(subtotal + deliveryFee);
  const publicId = `RO-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`;

  const created = await db.transaction(async (tx) => {
    const result = await tx.insert(orders).values({
      publicId,
      userId: input.userId,
      state: "ORDER_CREATED",
      idempotencyKey: input.idempotencyKey,
      linesJson: JSON.stringify(input.lines),
      subtotal: subtotal.toFixed(2),
      deliveryFee: deliveryFee.toFixed(2),
      total: total.toFixed(2),
      address: input.address,
      paymentMethod: input.paymentMethod,
    });
    const orderId = Number(result[0].insertId);
    await tx.insert(orderEvents).values({
      orderId,
      eventType: "OrderPlaced",
      payloadJson: JSON.stringify({ publicId, total }),
    });
    return orderId;
  });

  const rows = await db.select().from(orders).where(eq(orders.id, created)).limit(1);
  if (!rows[0]) throw new Error("ORDER_CREATE_FAILED");
  return normalizeOrder(rows[0]);
}

export async function advanceOrder(userId: number, publicId: string) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");

  const rows = await db.select().from(orders).where(and(eq(orders.userId, userId), eq(orders.publicId, publicId))).limit(1);
  const current = rows[0];
  if (!current) throw new Error("ORDER_NOT_FOUND");
  const from = current.state as OrderState;
  const to = nextState[from];
  if (!to) return normalizeOrder(current);

  await db.transaction(async (tx) => {
    if (to === "INVENTORY_RESERVED") {
      const lines = JSON.parse(current.linesJson) as Array<{ productId: string; quantity: number }>;
      for (const line of lines) {
        const inventory = await tx.select().from(inventoryItems).where(eq(inventoryItems.productId, line.productId)).limit(1);
        if (!inventory[0] || inventory[0].availableQuantity < line.quantity) throw new Error("INVENTORY_UNAVAILABLE");
        const reservation = await tx.update(inventoryItems).set({
          availableQuantity: inventory[0].availableQuantity - line.quantity,
          reservedQuantity: inventory[0].reservedQuantity + line.quantity,
          version: inventory[0].version + 1,
        }).where(and(eq(inventoryItems.productId, line.productId), eq(inventoryItems.version, inventory[0].version)));
        if ((reservation as { affectedRows?: number }).affectedRows === 0) throw new Error("INVENTORY_CONFLICT");
      }
    }

    await tx.update(orders).set({ state: to }).where(and(eq(orders.id, current.id), eq(orders.state, from)));
    const eventType = eventForState[to];
    if (eventType) {
      await tx.insert(orderEvents).values({
        orderId: current.id,
        eventType,
        payloadJson: JSON.stringify({ publicId, from, to }),
      });
    }
  });

  const updated = await db.select().from(orders).where(eq(orders.id, current.id)).limit(1);
  if (!updated[0]) throw new Error("ORDER_UPDATE_FAILED");
  return normalizeOrder(updated[0]);
}

export async function confirmDelivery(userId: number, publicId: string) {
  const current = await getOrderForUser(userId, publicId);
  if (!current || current.state !== "OUT_FOR_DELIVERY") return current;
  return advanceOrder(userId, publicId);
}

export async function listBackordersForUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  return db.select().from(backorderSubscriptions).where(eq(backorderSubscriptions.userId, userId)).orderBy(asc(backorderSubscriptions.createdAt));
}

export async function registerBackorder(input: {
  userId: number;
  productId: string;
  productName: string;
  channelPreference: Channel;
  idempotencyKey: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const activeKey = `${input.userId}:${input.productId}:${input.channelPreference}`;
  const existing = await db.select().from(backorderSubscriptions).where(eq(backorderSubscriptions.activeKey, activeKey)).limit(1);
  if (existing[0]) return existing[0];

  try {
    const result = await db.insert(backorderSubscriptions).values({
      userId: input.userId,
      productId: input.productId,
      productName: input.productName,
      channelPreference: input.channelPreference,
      state: "PENDING",
      idempotencyKey: input.idempotencyKey,
      activeKey,
    });
    const rows = await db.select().from(backorderSubscriptions).where(eq(backorderSubscriptions.id, Number(result[0].insertId))).limit(1);
    if (!rows[0]) throw new Error("BACKORDER_CREATE_FAILED");
    return rows[0];
  } catch (error) {
    const retry = await db.select().from(backorderSubscriptions).where(eq(backorderSubscriptions.activeKey, activeKey)).limit(1);
    if (retry[0]) return retry[0];
    throw error;
  }
}

export async function processRestockEvent(input: {
  eventId: string;
  productId: string;
  quantityAdded: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const existing = await db.select().from(restockEventInbox).where(eq(restockEventInbox.eventId, input.eventId)).limit(1);
  if (existing[0]) return { duplicate: true, claimed: 0, queued: 0 };

  const claimed = await db.transaction(async (tx) => {
    const inbox = await tx.insert(restockEventInbox).values({
      eventId: input.eventId,
      productId: input.productId,
      quantityAdded: input.quantityAdded,
      payloadJson: JSON.stringify({ product_id: input.productId, quantity_added: input.quantityAdded }),
      status: "RECEIVED",
    });
    const pending = await tx.select().from(backorderSubscriptions).where(and(eq(backorderSubscriptions.productId, input.productId), eq(backorderSubscriptions.state, "PENDING"))).orderBy(asc(backorderSubscriptions.id));
    let queued = 0;
    for (const subscription of pending) {
      const transition = await tx.update(backorderSubscriptions).set({ state: "NOTIFYING", notifyingAt: new Date() }).where(and(eq(backorderSubscriptions.id, subscription.id), eq(backorderSubscriptions.state, "PENDING")));
      if ((transition as { affectedRows?: number }).affectedRows === 0) continue;
      const idempotencyKey = `${subscription.id}:${input.eventId}:${subscription.channelPreference}`;
      await tx.insert(notificationOutbox).values({
        subscriptionId: subscription.id,
        sourceEventId: input.eventId,
        channel: subscription.channelPreference,
        idempotencyKey,
        queueName: queueForChannel(subscription.channelPreference),
        payloadJson: JSON.stringify({ product_id: input.productId, quantity_added: input.quantityAdded }),
        state: "QUEUED",
      });
      queued += 1;
    }
    await tx.update(restockEventInbox).set({ status: "PROCESSED", processedAt: new Date() }).where(eq(restockEventInbox.id, Number(inbox[0].insertId)));
    return { duplicate: false, claimed: pending.length, queued };
  });
  return claimed;
}

export async function processNotificationQueue(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const subscriptions = await db.select({ id: backorderSubscriptions.id }).from(backorderSubscriptions).where(eq(backorderSubscriptions.userId, userId));
  const ids = subscriptions.map((item) => item.id);
  if (!ids.length) return { processed: 0 };
  const queued = await db.select().from(notificationOutbox).where(and(inArray(notificationOutbox.subscriptionId, ids), eq(notificationOutbox.state, "QUEUED"))).orderBy(asc(notificationOutbox.id));
  for (const job of queued) {
    await db.update(notificationOutbox).set({ state: "SENT", sentAt: new Date(), attemptCount: job.attemptCount + 1 }).where(and(eq(notificationOutbox.id, job.id), eq(notificationOutbox.state, "QUEUED")));
    await db.update(backorderSubscriptions).set({ state: "NOTIFIED", activeKey: null, notifiedAt: new Date() }).where(and(eq(backorderSubscriptions.id, job.subscriptionId), eq(backorderSubscriptions.state, "NOTIFYING")));
  }
  return { processed: queued.length };
}

export function nextOrderState(state: OrderState) {
  return nextState[state] ?? null;
}
