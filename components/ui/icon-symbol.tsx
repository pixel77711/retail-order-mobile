import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { type ComponentProps } from "react";
import { type OpaqueColorValue, type StyleProp, type TextStyle } from "react-native";

type IconName = ComponentProps<typeof MaterialIcons>["name"];

const MAPPING: Record<string, IconName> = {
  "house.fill": "home",
  "bag.fill": "shopping-bag",
  "person.fill": "person",
  "cart.fill": "shopping-cart",
  "magnifyingglass": "search",
  "chevron.right": "chevron-right",
  "chevron.left": "chevron-left",
  "plus": "add",
  "minus": "remove",
  "checkmark.circle.fill": "check-circle",
  "clock.fill": "schedule",
  "location.fill": "location-on",
  "creditcard.fill": "credit-card",
  "bicycle": "directions-bike",
  "bell.fill": "notifications-none",
  "arrow.clockwise": "refresh",
  "xmark": "close",
  "cube.box.fill": "inventory-2",
  "arrow.up.right": "north-east",
};

export type IconSymbolName = string;

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
  weight,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: string;
}) {
  const mappedName = MAPPING[name] ?? (name as IconName);
  return <MaterialIcons color={color} size={size} name={mappedName} style={style} />;
}
