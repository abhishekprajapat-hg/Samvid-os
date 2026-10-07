import React from "react";
import type { StyleProp, TextStyle } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { brand } from "../../theme/brand";

/*
 * The icon family the mobile comps draw.
 *
 * `Icon` (lucide) stays the family for every screen ported from web, because
 * web draws lucide and that is the parity contract. The comps are not a port -
 * they are solid glyphs: a filled house, a three-person group, a circle with a
 * plus knocked out of it. Lucide has one stroke cut and no filled variant, so
 * drawing the comps with it would mean redrawing every mark by hand.
 *
 * Those glyphs are Ionicons, which @expo/vector-icons already ships. So the
 * redrawn surfaces use this and the ported ones keep using `Icon`, until the
 * rest of the comps arrive and the lucide adapter can go.
 */

export type GlyphName = React.ComponentProps<typeof Ionicons>["name"];

export const Glyph = ({
  name,
  size = 20,
  color,
  style,
}: {
  name: GlyphName;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
}) => <Ionicons name={name} size={size} color={color ?? brand.green} style={style} />;

export default Glyph;
