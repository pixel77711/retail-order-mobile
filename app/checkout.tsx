import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScreenContainer } from "@/components/screen-container";
import { eventForStatus, money, products, type Order, type OrderStatus } from "@/lib/order-domain";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/use-auth";
import { useOrderStore } from "@/lib/order-store";

export default function CheckoutScreen() {
  const { cart, placeOrder, adoptServerOrder } = useOrderStore();
  const { isAuthenticated } = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const createOrderMutation = trpc.orders.create.useMutation();
  const subtotal = cart.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const deliveryFee = subtotal >= 30 ? 0 : 2.5;
  const total = subtotal + deliveryFee;

  const submitOrder = async () => {
    if (!cart.length || createOrderMutation.isPending) return;
    setSubmitError(null);

    if (!isAuthenticated) {
      placeOrder();
      router.replace("/order-processing" as any);
      return;
    }

    try {
      const serverOrder = await createOrderMutation.mutateAsync({
        idempotencyKey: `mobile-order-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        lines: cart.map((line) => ({ productId: line.id, quantity: line.quantity, unitPrice: line.price })),
        address: "18 Cedar Lane, Apt 4B",
        paymentMethod: "pm_demo_visa_4242",
      });
      const lines = serverOrder.lines.map((line) => {
        const product = products.find((item) => item.id === line.productId) ?? products[0];
        return { ...product, quantity: line.quantity, price: line.unitPrice };
      });
      const nextOrder: Order = {
        id: String(serverOrder.id),
        displayId: serverOrder.publicId,
        createdAt: new Date(serverOrder.createdAt).toISOString(),
        status: serverOrder.state as OrderStatus,
        lines,
        subtotal: Number(serverOrder.subtotal),
        deliveryFee: Number(serverOrder.deliveryFee),
        total: Number(serverOrder.total),
        address: serverOrder.address,
        paymentMethod: "Visa ending 4242",
        events: [],
      };
      const event = eventForStatus("ORDER_CREATED", nextOrder);
      adoptServerOrder({ ...nextOrder, events: event ? [event] : [] });
      router.replace("/order-processing" as any);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to place the order.";
      setSubmitError(message);
      Alert.alert("Order not placed", "We could not reach the order service. Your cart is still safe; please try again.");
    }
  };

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} className="px-5" containerClassName="bg-background">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View className="mb-6 flex-row items-center justify-between">
          <Pressable accessibilityRole="button" accessibilityLabel="Back to cart" onPress={() => router.back()} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}><IconSymbol name="chevron.left" size={22} color="#22324A" /></Pressable>
          <Text className="text-[18px] font-bold text-foreground">Checkout</Text>
          <View className="w-10" />
        </View>
        <Text className="text-[29px] font-bold tracking-[-0.6px] text-foreground">Almost there.</Text>
        <Text className="mt-2 text-[14px] leading-5 text-muted">Review the details below, then we’ll send your order through the fulfillment flow.</Text>

        {!isAuthenticated && <View className="mt-5 rounded-2xl border border-[#F5D9A9] bg-[#FFF8E8] p-3"><Text className="text-[12px] font-bold text-[#9A6411]">Preview mode</Text><Text className="mt-1 text-[11px] leading-4 text-[#9A6411]">Sign in to persist orders through the production API. This preview keeps the cart flow usable locally.</Text></View>}

        <Text className="mb-3 mt-8 text-[17px] font-bold text-foreground">Delivery details</Text>
        <View className="rounded-[22px] bg-surface p-4" style={styles.cardShadow}>
          <View className="flex-row items-start"><View className="h-10 w-10 items-center justify-center rounded-xl bg-[#EAF5EE]"><IconSymbol name="location.fill" size={20} color="#1F9D72" /></View><View className="ml-3 flex-1"><Text className="text-[14px] font-bold text-foreground">Home</Text><Text className="mt-1 text-[13px] leading-5 text-muted">18 Cedar Lane, Apt 4B{`\n`}Leave at the door</Text></View><Text className="text-[12px] font-bold text-primary">Edit</Text></View>
        </View>

        <Text className="mb-3 mt-6 text-[17px] font-bold text-foreground">Payment method</Text>
        <View className="rounded-[22px] bg-surface p-4" style={styles.cardShadow}>
          <View className="flex-row items-center"><View className="h-10 w-10 items-center justify-center rounded-xl bg-[#F0EAF8]"><IconSymbol name="creditcard.fill" size={20} color="#7355A6" /></View><View className="ml-3 flex-1"><Text className="text-[14px] font-bold text-foreground">Visa ending 4242</Text><Text className="mt-1 text-[12px] text-muted">Secure payment reference; card data stays with the provider</Text></View><IconSymbol name="checkmark.circle.fill" size={21} color="#1F9D72" /></View>
        </View>

        <Text className="mb-3 mt-6 text-[17px] font-bold text-foreground">Order summary</Text>
        <View className="rounded-[22px] bg-surface p-5" style={styles.cardShadow}>
          {cart.map((line) => <View key={line.id} className="mb-3 flex-row justify-between"><Text className="flex-1 text-[14px] text-muted">{line.quantity} × {line.name}</Text><Text className="text-[14px] font-semibold text-foreground">{money(line.price * line.quantity)}</Text></View>)}
          <View className="mb-4 h-px bg-border" />
          <View className="mb-3 flex-row justify-between"><Text className="text-[14px] text-muted">Subtotal</Text><Text className="text-[14px] font-semibold text-foreground">{money(subtotal)}</Text></View>
          <View className="mb-4 flex-row justify-between"><Text className="text-[14px] text-muted">Delivery</Text><Text className="text-[14px] font-semibold text-foreground">{deliveryFee === 0 ? "Free" : money(deliveryFee)}</Text></View>
          <View className="flex-row justify-between"><Text className="text-[17px] font-bold text-foreground">Total</Text><Text className="text-[20px] font-bold text-primary">{money(total)}</Text></View>
        </View>
        {submitError && <Text className="mt-3 text-center text-[12px] font-semibold text-error">{submitError}</Text>}
        <Pressable disabled={cart.length === 0 || createOrderMutation.isPending} onPress={submitOrder} style={({ pressed }) => [styles.primaryButton, (cart.length === 0 || createOrderMutation.isPending) && styles.disabled, pressed && styles.pressed]}><Text className="text-[15px] font-bold text-white">{createOrderMutation.isPending ? "Placing order…" : "Place order"}</Text><IconSymbol name="arrow.up.right" size={18} color="#FFFFFF" /></Pressable>
        <Text className="mt-3 text-center text-[11px] leading-4 text-muted">By placing your order, payment is authorized and inventory is reserved before dispatch begins.</Text>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 18, paddingBottom: 28 },
  iconButton: { height: 40, width: 40, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E5E7EB" },
  primaryButton: { height: 54, marginTop: 24, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 17, backgroundColor: "#E85D4A" },
  cardShadow: { shadowColor: "#22324A", shadowOpacity: 0.055, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
