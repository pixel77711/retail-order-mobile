CREATE TABLE `backorder_subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`productId` varchar(128) NOT NULL,
	`productName` varchar(255) NOT NULL,
	`channelPreference` enum('PUSH','EMAIL','SMS') NOT NULL,
	`state` enum('PENDING','NOTIFYING','NOTIFIED','FAILED','CANCELLED') NOT NULL DEFAULT 'PENDING',
	`idempotencyKey` varchar(255) NOT NULL,
	`activeKey` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`notifyingAt` timestamp,
	`notifiedAt` timestamp,
	`lastError` varchar(512),
	CONSTRAINT `backorder_subscriptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `backorder_subscriptions_idempotencyKey_unique` UNIQUE(`idempotencyKey`),
	CONSTRAINT `backorder_active_key_uq` UNIQUE(`activeKey`)
);
--> statement-breakpoint
CREATE TABLE `inventory_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` varchar(128) NOT NULL,
	`availableQuantity` int NOT NULL DEFAULT 0,
	`reservedQuantity` int NOT NULL DEFAULT 0,
	`version` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `inventory_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `inventory_items_productId_unique` UNIQUE(`productId`)
);
--> statement-breakpoint
CREATE TABLE `notification_outbox` (
	`id` int AUTO_INCREMENT NOT NULL,
	`subscriptionId` int NOT NULL,
	`sourceEventId` varchar(255) NOT NULL,
	`channel` enum('PUSH','EMAIL','SMS') NOT NULL,
	`idempotencyKey` varchar(512) NOT NULL,
	`queueName` varchar(128) NOT NULL,
	`payloadJson` text NOT NULL,
	`state` enum('QUEUED','SENT','FAILED') NOT NULL DEFAULT 'QUEUED',
	`attemptCount` int NOT NULL DEFAULT 0,
	`nextAttemptAt` timestamp NOT NULL DEFAULT (now()),
	`providerMessageId` varchar(255),
	`lastError` varchar(512),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`sentAt` timestamp,
	CONSTRAINT `notification_outbox_id` PRIMARY KEY(`id`),
	CONSTRAINT `notification_outbox_idempotencyKey_unique` UNIQUE(`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `order_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`eventType` varchar(64) NOT NULL,
	`payloadJson` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `order_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `order_events_order_type_uq` UNIQUE(`orderId`,`eventType`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`publicId` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`state` enum('ORDER_CREATED','INVENTORY_RESERVED','PAYMENT_CONFIRMED','RIDER_ASSIGNED','OUT_FOR_DELIVERY','DELIVERED','CANCELLED','FAILED') NOT NULL DEFAULT 'ORDER_CREATED',
	`idempotencyKey` varchar(255) NOT NULL,
	`linesJson` text NOT NULL,
	`subtotal` decimal(10,2) NOT NULL,
	`deliveryFee` decimal(10,2) NOT NULL,
	`total` decimal(10,2) NOT NULL,
	`address` varchar(500) NOT NULL,
	`paymentMethod` varchar(128) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `orders_publicId_unique` UNIQUE(`publicId`),
	CONSTRAINT `orders_idempotencyKey_unique` UNIQUE(`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `restock_event_inbox` (
	`id` int AUTO_INCREMENT NOT NULL,
	`eventId` varchar(255) NOT NULL,
	`productId` varchar(128) NOT NULL,
	`quantityAdded` int NOT NULL,
	`payloadJson` text NOT NULL,
	`status` enum('RECEIVED','PROCESSED','FAILED') NOT NULL DEFAULT 'RECEIVED',
	`receivedAt` timestamp NOT NULL DEFAULT (now()),
	`processedAt` timestamp,
	CONSTRAINT `restock_event_inbox_id` PRIMARY KEY(`id`),
	CONSTRAINT `restock_event_inbox_eventId_unique` UNIQUE(`eventId`)
);
--> statement-breakpoint
CREATE INDEX `backorder_product_state_idx` ON `backorder_subscriptions` (`productId`,`state`,`id`);--> statement-breakpoint
CREATE INDEX `backorder_user_created_idx` ON `backorder_subscriptions` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `notification_queue_scan_idx` ON `notification_outbox` (`queueName`,`state`,`nextAttemptAt`);--> statement-breakpoint
CREATE INDEX `notification_subscription_idx` ON `notification_outbox` (`subscriptionId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `order_events_order_created_idx` ON `order_events` (`orderId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `orders_user_created_idx` ON `orders` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `orders_user_state_idx` ON `orders` (`userId`,`state`);--> statement-breakpoint
CREATE INDEX `restock_product_received_idx` ON `restock_event_inbox` (`productId`,`receivedAt`);