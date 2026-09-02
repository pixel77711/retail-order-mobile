import { decimal, index, int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  publicId: varchar("publicId", { length: 64 }).notNull().unique(),
  userId: int("userId").notNull(),
  state: mysqlEnum("state", ["ORDER_CREATED", "INVENTORY_RESERVED", "PAYMENT_CONFIRMED", "RIDER_ASSIGNED", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED", "FAILED"]).default("ORDER_CREATED").notNull(),
  idempotencyKey: varchar("idempotencyKey", { length: 255 }).notNull().unique(),
  linesJson: text("linesJson").notNull(),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  deliveryFee: decimal("deliveryFee", { precision: 10, scale: 2 }).notNull(),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  address: varchar("address", { length: 500 }).notNull(),
  paymentMethod: varchar("paymentMethod", { length: 128 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userCreatedIdx: index("orders_user_created_idx").on(table.userId, table.createdAt),
  userStateIdx: index("orders_user_state_idx").on(table.userId, table.state),
}));

export const orderEvents = mysqlTable("order_events", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  eventType: varchar("eventType", { length: 64 }).notNull(),
  payloadJson: text("payloadJson").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  orderEventUniq: uniqueIndex("order_events_order_type_uq").on(table.orderId, table.eventType),
  orderCreatedIdx: index("order_events_order_created_idx").on(table.orderId, table.createdAt),
}));

export const inventoryItems = mysqlTable("inventory_items", {
  id: int("id").autoincrement().primaryKey(),
  productId: varchar("productId", { length: 128 }).notNull().unique(),
  availableQuantity: int("availableQuantity").default(0).notNull(),
  reservedQuantity: int("reservedQuantity").default(0).notNull(),
  version: int("version").default(0).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const backorderSubscriptions = mysqlTable("backorder_subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  productId: varchar("productId", { length: 128 }).notNull(),
  productName: varchar("productName", { length: 255 }).notNull(),
  channelPreference: mysqlEnum("channelPreference", ["PUSH", "EMAIL", "SMS"]).notNull(),
  state: mysqlEnum("state", ["PENDING", "NOTIFYING", "NOTIFIED", "FAILED", "CANCELLED"]).default("PENDING").notNull(),
  idempotencyKey: varchar("idempotencyKey", { length: 255 }).notNull().unique(),
  activeKey: varchar("activeKey", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  notifyingAt: timestamp("notifyingAt"),
  notifiedAt: timestamp("notifiedAt"),
  lastError: varchar("lastError", { length: 512 }),
}, (table) => ({
  activeSubscriptionUq: uniqueIndex("backorder_active_key_uq").on(table.activeKey),
  productStateIdx: index("backorder_product_state_idx").on(table.productId, table.state, table.id),
  userCreatedIdx: index("backorder_user_created_idx").on(table.userId, table.createdAt),
}));

export const restockEventInbox = mysqlTable("restock_event_inbox", {
  id: int("id").autoincrement().primaryKey(),
  eventId: varchar("eventId", { length: 255 }).notNull().unique(),
  productId: varchar("productId", { length: 128 }).notNull(),
  quantityAdded: int("quantityAdded").notNull(),
  payloadJson: text("payloadJson").notNull(),
  status: mysqlEnum("status", ["RECEIVED", "PROCESSED", "FAILED"]).default("RECEIVED").notNull(),
  receivedAt: timestamp("receivedAt").defaultNow().notNull(),
  processedAt: timestamp("processedAt"),
}, (table) => ({
  productReceivedIdx: index("restock_product_received_idx").on(table.productId, table.receivedAt),
}));

export const notificationOutbox = mysqlTable("notification_outbox", {
  id: int("id").autoincrement().primaryKey(),
  subscriptionId: int("subscriptionId").notNull(),
  sourceEventId: varchar("sourceEventId", { length: 255 }).notNull(),
  channel: mysqlEnum("channel", ["PUSH", "EMAIL", "SMS"]).notNull(),
  idempotencyKey: varchar("idempotencyKey", { length: 512 }).notNull().unique(),
  queueName: varchar("queueName", { length: 128 }).notNull(),
  payloadJson: text("payloadJson").notNull(),
  state: mysqlEnum("state", ["QUEUED", "SENT", "FAILED"]).default("QUEUED").notNull(),
  attemptCount: int("attemptCount").default(0).notNull(),
  nextAttemptAt: timestamp("nextAttemptAt").defaultNow().notNull(),
  providerMessageId: varchar("providerMessageId", { length: 255 }),
  lastError: varchar("lastError", { length: 512 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  sentAt: timestamp("sentAt"),
}, (table) => ({
  queueScanIdx: index("notification_queue_scan_idx").on(table.queueName, table.state, table.nextAttemptAt),
  subscriptionIdx: index("notification_subscription_idx").on(table.subscriptionId, table.createdAt),
}));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;
export type OrderEvent = typeof orderEvents.$inferSelect;
export type BackorderSubscription = typeof backorderSubscriptions.$inferSelect;
export type NotificationOutbox = typeof notificationOutbox.$inferSelect;
