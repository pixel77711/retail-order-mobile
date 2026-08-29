import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScreenContainer } from "@/components/screen-container";
import { money } from "@/lib/order-domain";
import { useOrderStore } from "@/lib/order-store";

export default function CartScreen() {
  const { cart, updateQuantity } = useOrderStore();
  const subtotal = cart.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const deliveryFee = subtotal >= 30 || subtotal === 0 ? 0 : 2.5;
  const total = subtotal + deliveryFee;

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} className="px-5" containerClassName="bg-background">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View className="mb-6 flex-row items-center justify-between">
          <Pressable accessibilityRole="button" accessibilityLabel="Close cart" onPress={() => router.back()} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
            <IconSymbol name="xmark" size={21} color="#22324A" />
          </Pressable>
          <Text className="text-[18px] font-bold text-foreground">Your basket</Text>
          <View className="w-10" />
        </View>
        <View className="mb-6 rounded-[22px] bg-[#EAF5EE] px-4 py-3">
          <View className="flex-row items-center">
            <IconSymbol name="checkmark.circle.fill" size={19} color="#1F9D72" />
            <Text className="ml-2 flex-1 text-[13px] font-semibold text-[#217A5D]">Free delivery when you spend $30</Text>
          </View>
        </View>
        {cart.length === 0 ? (
          <View className="items-center rounded-[24px] bg-surface px-5 py-12">
            <Text className="text-[44px]">🧺</Text>
            <Text className="mt-3 text-[18px] font-bold text-foreground">Your basket is empty</Text>
            <Text className="mt-2 text-center text-[14px] leading-5 text-muted">Add a few essentials from Cedar Market to get started.</Text>
            <Pressable onPress={() => router.replace("/(tabs)" as any)} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
              <Text className="text-[15px] font-bold text-white">Browse essentials</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View className="gap-3">
              {cart.map((line) => (
                <View key={line.id} className="flex-row items-center rounded-[22px] bg-surface p-3" style={styles.cardShadow}>
                  <View className="h-16 w-16 items-center justify-center rounded-2xl" style={{ backgroundColor: line.accent }}>
                    <Text className="text-[30px]">{line.id === "p-avocado" ? "🥑" : line.id === "p-bread" ? "🍞" : line.id === "p-coffee" ? "☕" : "🛍️"}</Text>
                  </View>
                  <View className="ml-3 flex-1">
                    <Text className="text-[15px] font-bold text-foreground">{line.name}</Text>
                    <Text className="mt-1 text-[12px] text-muted">{money(line.price)} · {line.unit}</Text>
                    <View className="mt-2 flex-row items-center">
                      <Pressable onPress={() => updateQuantity(line.id, line.quantity - 1)} style={({ pressed }) => [styles.quantityButton, pressed && styles.pressed]}><IconSymbol name="minus" size={16} color="#22324A" /></Pressable>
                      <Text className="mx-3 text-[14px] font-bold text-foreground">{line.quantity}</Text>
                      <Pressable onPress={() => updateQuantity(line.id, line.quantity + 1)} style={({ pressed }) => [styles.quantityButton, pressed && styles.pressed]}><IconSymbol name="plus" size={16} color="#22324A" /></Pressable>
                    </View>
                  </View>
                  <Text className="self-start text-[15px] font-bold text-foreground">{money(line.price * line.quantity)}</Text>
                </View>
              ))}
            </View>
            <View className="mt-8 rounded-[24px] bg-surface p-5" style={styles.cardShadow}>
              <Text className="mb-4 text-[17px] font-bold text-foreground">Order summary</Text>
              <View className="mb-3 flex-row justify-between"><Text className="text-[14px] text-muted">Subtotal</Text><Text className="text-[14px] font-semibold text-foreground">{money(subtotal)}</Text></View>
              <View className="mb-4 flex-row justify-between"><Text className="text-[14px] text-muted">Delivery</Text><Text className="text-[14px] font-semibold text-foreground">{deliveryFee === 0 ? "Free" : money(deliveryFee)}</Text></View>
              <View className="mb-5 h-px bg-border" />
              <View className="flex-row justify-between"><Text className="text-[17px] font-bold text-foreground">Total</Text><Text className="text-[20px] font-bold text-primary">{money(total)}</Text></View>
              <Pressable onPress={() => router.push("/checkout" as any)} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
                <Text className="text-[15px] font-bold text-white">Continue to checkout</Text>
                <IconSymbol name="chevron.right" size={19} color="#FFFFFF" />
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 18, paddingBottom: 30 },
  iconButton: { height: 40, width: 40, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E5E7EB" },
  quantityButton: { height: 27, width: 27, alignItems: "center", justifyContent: "center", borderRadius: 9, backgroundColor: "#F1F3F5" },
  primaryButton: { height: 52, marginTop: 20, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 17, backgroundColor: "#E85D4A" },
  cardShadow: { shadowColor: "#22324A", shadowOpacity: 0.055, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
