import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  advanceOrder,
  confirmDelivery,
  createOrder,
  getOrderForUser,
  listBackordersForUser,
  listOrdersForUser,
  processNotificationQueue,
  processRestockEvent,
  registerBackorder,
  type Channel,
} from "./retail-service";

const channelSchema = z.enum(["PUSH", "EMAIL", "SMS"]);

function serviceError(error: unknown): never {
  const code = error instanceof Error ? error.message : "INTERNAL_ERROR";
  const known: Record<string, "CONFLICT" | "NOT_FOUND" | "PRECONDITION_FAILED" | "INTERNAL_SERVER_ERROR"> = {
    IDEMPOTENCY_KEY_CONFLICT: "CONFLICT",
    ORDER_NOT_FOUND: "NOT_FOUND",
    INVENTORY_UNAVAILABLE: "PRECONDITION_FAILED",
    DATABASE_UNAVAILABLE: "INTERNAL_SERVER_ERROR",
  };
  throw new TRPCError({ code: known[code] ?? "INTERNAL_SERVER_ERROR", message: code });
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  orders: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      try {
        return await listOrdersForUser(ctx.user.id);
      } catch (error) {
        return serviceError(error);
      }
    }),
    get: protectedProcedure.input(z.object({ publicId: z.string().min(1).max(64) })).query(async ({ ctx, input }) => {
      try {
        return await getOrderForUser(ctx.user.id, input.publicId);
      } catch (error) {
        return serviceError(error);
      }
    }),
    create: protectedProcedure.input(z.object({
      idempotencyKey: z.string().min(8).max(255),
      lines: z.array(z.object({
        productId: z.string().min(1).max(128),
        quantity: z.number().int().positive().max(99),
        unitPrice: z.number().nonnegative().max(100000),
      })).min(1).max(50),
      address: z.string().min(5).max(500),
      paymentMethod: z.string().min(3).max(128),
    })).mutation(async ({ ctx, input }) => {
      try {
        return await createOrder({ ...input, userId: ctx.user.id });
      } catch (error) {
        return serviceError(error);
      }
    }),
    advance: protectedProcedure.input(z.object({ publicId: z.string().min(1).max(64) })).mutation(async ({ ctx, input }) => {
      try {
        return await advanceOrder(ctx.user.id, input.publicId);
      } catch (error) {
        return serviceError(error);
      }
    }),
    confirmDelivery: protectedProcedure.input(z.object({ publicId: z.string().min(1).max(64) })).mutation(async ({ ctx, input }) => {
      try {
        return await confirmDelivery(ctx.user.id, input.publicId);
      } catch (error) {
        return serviceError(error);
      }
    }),
  }),

  backorders: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      try {
        return await listBackordersForUser(ctx.user.id);
      } catch (error) {
        return serviceError(error);
      }
    }),
    register: protectedProcedure.input(z.object({
      productId: z.string().min(1).max(128),
      productName: z.string().min(1).max(255),
      channelPreference: channelSchema,
      idempotencyKey: z.string().min(8).max(255),
    })).mutation(async ({ ctx, input }) => {
      try {
        return await registerBackorder({ ...input, userId: ctx.user.id, channelPreference: input.channelPreference as Channel });
      } catch (error) {
        return serviceError(error);
      }
    }),
    processRestock: adminProcedure.input(z.object({
      eventId: z.string().min(8).max(255),
      productId: z.string().min(1).max(128),
      quantityAdded: z.number().int().positive().max(1000000),
    })).mutation(async ({ input }) => {
      try {
        return await processRestockEvent(input);
      } catch (error) {
        return serviceError(error);
      }
    }),
    processQueue: adminProcedure.mutation(async ({ ctx }) => {
      try {
        return await processNotificationQueue(ctx.user.id);
      } catch (error) {
        return serviceError(error);
      }
    }),
  }),
});

export type AppRouter = typeof appRouter;
