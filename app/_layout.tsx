import "../global.css";

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { OrderProvider } from "@/lib/order-store";
import { BackorderProvider } from "@/lib/backorder-store";
import { ThemeProvider } from "@/lib/theme-provider";

export default function RootLayout() {
  return (
    <ThemeProvider>
      <OrderProvider>
        <BackorderProvider>
          <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="cart" options={{ presentation: "modal" }} />
          <Stack.Screen name="checkout" options={{ presentation: "modal" }} />
          <Stack.Screen name="order-processing" />
          <Stack.Screen name="order-detail" />
          </Stack>
        </BackorderProvider>
      </OrderProvider>
    </ThemeProvider>
  );
}
