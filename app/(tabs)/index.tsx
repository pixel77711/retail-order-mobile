import { useMemo, useState } from "react";
import { FlatList, Pressable, Text, TextInput, View, StyleSheet } from "react-native";
import { router } from "expo-router";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScreenContainer } from "@/components/screen-container";
import { money, products, type Product } from "@/lib/order-domain";
import { useOrderStore } from "@/lib/order-store";
import { backorderStateLabel } from "@/lib/backorder-domain";
import { useBackorderStore } from "@/lib/backorder-store";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";

const categories = ["All", "Fresh picks", "Bakery", "Pantry", "Chilled"];

export default function HomeScreen() {
  const { cart, addToCart } = useOrderStore();
  const { subscriptions, registerSubscription, adoptServerSubscription } = useBackorderStore();
  const { isAuthenticated } = useAuth();
  const registerBackorderMutation = trpc.backorders.register.useMutation();
  const [notifySubmitting, setNotifySubmitting] = useState(false);
  const backorderProductId = "PROD-123";
  const subscription = subscriptions.find((item) => item.productId === backorderProductId && item.state !== "CANCELLED");

  const handleNotify = async () => {
    if (subscription || notifySubmitting) return;
    setNotifySubmitting(true);
    try {
      if (!isAuthenticated) {
        registerSubscription(backorderProductId, "Seasonal Citrus Box", "PUSH");
        return;
      }
      const serverSubscription = await registerBackorderMutation.mutateAsync({
        productId: backorderProductId,
        productName: "Seasonal Citrus Box",
        channelPreference: "PUSH",
        idempotencyKey: `backorder-${backorderProductId}-PUSH`,
      });
      adoptServerSubscription({
        id: String(serverSubscription.id),
        userId: String(serverSubscription.userId),
        productId: serverSubscription.productId,
        productName: serverSubscription.productName,
        channelPreference: serverSubscription.channelPreference,
        state: serverSubscription.state,
        createdAt: new Date(serverSubscription.createdAt).toISOString(),
        notifyingAt: serverSubscription.notifyingAt ? new Date(serverSubscription.notifyingAt).toISOString() : undefined,
        notifiedAt: serverSubscription.notifiedAt ? new Date(serverSubscription.notifiedAt).toISOString() : undefined,
        lastError: serverSubscription.lastError ?? undefined,
      });
    } finally {
      setNotifySubmitting(false);
    }
  };
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");

  const filteredProducts = useMemo(() => products.filter((product) => {
    const matchesCategory = category === "All" || product.category === category;
    const searchText = `${product.name} ${product.description}`.toLowerCase();
    return matchesCategory && searchText.includes(query.toLowerCase());
  }), [category, query]);

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const renderProduct = ({ item }: { item: Product }) => (
    <View className="mb-4 w-[48%] rounded-[22px] bg-surface p-3" style={styles.cardShadow}>
      <View className="mb-3 h-28 items-center justify-center rounded-2xl" style={{ backgroundColor: item.accent }}>
        <Text style={styles.productEmoji}>{item.id === "p-avocado" ? "🥑" : item.id === "p-bread" ? "🍞" : item.id === "p-berries" ? "🫐" : item.id === "p-coffee" ? "☕" : item.id === "p-milk" ? "🥛" : "🥣"}</Text>
      </View>
      <Text className="text-[11px] font-semibold uppercase tracking-[1px] text-muted">{item.category}</Text>
      <Text className="mt-1 text-[16px] font-bold leading-5 text-foreground">{item.name}</Text>
      <Text className="mt-1 text-[12px] leading-4 text-muted" numberOfLines={2}>{item.description}</Text>
      <View className="mt-3 flex-row items-center justify-between">
        <View>
          <Text className="text-[16px] font-bold text-foreground">{money(item.price)}</Text>
          <Text className="text-[11px] text-muted">{item.unit}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Add ${item.name} to cart`}
          onPress={() => addToCart(item)}
          style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
        >
          <IconSymbol name="plus" size={20} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );

  return (
    <ScreenContainer className="px-5" containerClassName="bg-background">
      <FlatList
        data={filteredProducts}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.column}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            <View className="mb-6 flex-row items-center justify-between">
              <View>
                <Text className="text-[13px] font-semibold uppercase tracking-[1.4px] text-primary">Cedar Market</Text>
                <Text className="mt-1 text-[29px] font-bold tracking-[-0.8px] text-foreground">Good morning, Alex</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open cart"
                onPress={() => router.push("/cart" as any)}
                style={({ pressed }) => [styles.cartButton, pressed && styles.pressed]}
              >
                <IconSymbol name="cart.fill" size={23} color="#22324A" />
                {cartCount > 0 && <View className="absolute -right-1 -top-1 min-w-[20px] items-center rounded-full bg-primary px-1 py-0.5"><Text className="text-[11px] font-bold text-white">{cartCount}</Text></View>}
              </Pressable>
            </View>
            <View className="mb-5 flex-row items-center rounded-2xl bg-surface px-4" style={styles.searchBox}>
              <IconSymbol name="magnifyingglass" size={20} color="#6B7280" />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search the market"
                placeholderTextColor="#9AA1A8"
                returnKeyType="search"
                className="ml-3 flex-1 py-3 text-[15px] text-foreground"
              />
            </View>
            <View className="mb-6 rounded-[24px] bg-navy-accent px-5 py-5" style={styles.heroShadow}>
              <View className="flex-row items-start justify-between">
                <View className="flex-1 pr-3">
                  <Text className="text-[12px] font-bold uppercase tracking-[1.5px] text-[#A9D7C5]">Fresh today</Text>
                  <Text className="mt-2 text-[24px] font-bold leading-7 text-white">A better basket,
one delivery away.</Text>
                  <Text className="mt-2 text-[13px] leading-5 text-[#C7D0D8]">Local favorites, packed with care and delivered to your door.</Text>
                </View>
                <Text style={styles.heroEmoji}>🛍️</Text>
              </View>
            </View>
            <View className="mb-5 flex-row items-center justify-between rounded-[22px] border border-[#F3D8D2] bg-[#FFF8F6] p-4">
              <View className="mr-3 h-11 w-11 items-center justify-center rounded-2xl bg-[#FDE5DF]"><IconSymbol name="bell.fill" size={21} color="#E85D4A" /></View>
              <View className="flex-1"><Text className="text-[11px] font-bold uppercase tracking-[1px] text-primary">Seasonal Citrus Box</Text><Text className="mt-1 text-[13px] font-semibold text-foreground">Currently out of stock</Text><Text className="mt-1 text-[11px] leading-4 text-muted">We’ll notify you as soon as a restock event arrives.</Text></View>
              <Pressable disabled={Boolean(subscription) || notifySubmitting} onPress={handleNotify} style={({ pressed }) => [styles.notifyButton, subscription && styles.notifyButtonActive, pressed && styles.pressed]}><Text className={subscription ? "text-[11px] font-bold text-success" : "text-[11px] font-bold text-primary"}>{subscription ? backorderStateLabel[subscription.state] : notifySubmitting ? "Saving…" : "Notify me"}</Text></Pressable>
            </View>
            <View className="mb-4 flex-row items-center justify-between">
              <Text className="text-[21px] font-bold text-foreground">Shop essentials</Text>
              <Text className="text-[13px] font-semibold text-primary">{filteredProducts.length} items</Text>
            </View>
            <FlatList
              horizontal
              data={categories}
              keyExtractor={(item) => item}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryList}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => setCategory(item)}
                  style={({ pressed }) => [styles.categoryChip, category === item && styles.categoryChipActive, pressed && styles.pressed]}
                >
                  <Text className={category === item ? "text-[13px] font-bold text-white" : "text-[13px] font-semibold text-muted"}>{item}</Text>
                </Pressable>
              )}
            />
          </View>
        }
        renderItem={renderProduct}
        ListEmptyComponent={<View className="items-center py-14"><Text className="text-base font-semibold text-foreground">No matching essentials</Text><Text className="mt-2 text-sm text-muted">Try another search or category.</Text></View>}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  listContent: { paddingTop: 18, paddingBottom: 34 },
  column: { justifyContent: "space-between" },
  categoryList: { gap: 8, paddingBottom: 18 },
  categoryChip: { borderRadius: 999, borderWidth: 1, borderColor: "#E1E5E9", backgroundColor: "#FFFFFF", paddingHorizontal: 15, paddingVertical: 9 },
  categoryChipActive: { borderColor: "#E85D4A", backgroundColor: "#E85D4A" },
  cartButton: { height: 45, width: 45, alignItems: "center", justifyContent: "center", borderRadius: 16, backgroundColor: "#FFFFFF", shadowColor: "#22324A", shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  addButton: { height: 34, width: 34, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "#E85D4A" },
  notifyButton: { borderRadius: 12, backgroundColor: "#FFF0ED", paddingHorizontal: 10, paddingVertical: 9 },
  notifyButtonActive: { backgroundColor: "#EAF5EE" },
  searchBox: { height: 50, borderWidth: 1, borderColor: "#E5E7EB" },
  cardShadow: { shadowColor: "#22324A", shadowOpacity: 0.055, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  heroShadow: { shadowColor: "#22324A", shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 5 },
  heroEmoji: { fontSize: 44, marginTop: 8 },
  productEmoji: { fontSize: 46 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.97 }] },
});
