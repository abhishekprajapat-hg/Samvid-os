import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Svg, { Circle, G, Line, Path, Rect } from "react-native-svg";
import { Glyph, type GlyphName } from "../../../components/ui/Glyph";
import { BrandButton } from "../../../components/brand/kit";
import { brand, brandStyles, round, type as t } from "../../../theme/brand";
import { getActiveScheme } from "../../../theme/themedStyles";
import { PASSAGE_BAND, PLANTS, SHARED_ROOMS, STATUS_META, STATUS_ORDER, type SharedRoom } from "../cabinData";
import { FLOOR_PLAN_ROOMS } from "../floorPlan";
import type { Cabin } from "../boardReducer";
import { CabinTile } from "./CabinTile";

/*
 * The floor as it is actually built - web's FloorLayoutMap.jsx and
 * FloorPlanArchitecture.jsx together.
 *
 * The September port left this on the desktop: scaled to a 390pt screen the
 * tiles are about 20pt across. It is here now because every web feature is,
 * and it is made usable the way a phone makes any drawing usable - the plan is
 * drawn at a readable size (never narrower than 760pt, as web's 820px floor)
 * and panned in both directions, with web's zoom steps on top. The wing grid
 * stays the default view for picking cabins; this one answers "which cabin is
 * next to the lift".
 */

const PLAN_W = 1684;
const PLAN_H = 1190;
const PLAN_RATIO = PLAN_W / PLAN_H;
const MIN_PLAN_WIDTH = 760;
const PASSAGE_LABEL_X = [21, 33.5, 46];
const X = (percent: number) => (percent / 100) * PLAN_W;
const Y = (percent: number) => (percent / 100) * PLAN_H;

const ROOM_ICONS: Record<string, GlyphName> = {
  cog: "cog",
  wash: "water",
  canteen: "restaurant",
  smoke: "flame",
};

/* Cabins sharing an x-range form one structural block; its outline is the wall. */
type Block = { left: number; right: number; top: number; bottom: number };
const BLOCKS: Block[] = Object.values(
  Object.entries(FLOOR_PLAN_ROOMS).reduce<Record<string, Block>>((groups, [, box]) => {
    const key = `${box.left.toFixed(1)}|${(box.left + box.width).toFixed(1)}`;
    const group = groups[key] || { left: box.left, right: box.left + box.width, top: Infinity, bottom: -Infinity };
    group.top = Math.min(group.top, box.top);
    group.bottom = Math.max(group.bottom, box.top + box.height);
    return { ...groups, [key]: group };
  }, {}),
);

const opensLeft = (block: Block) =>
  BLOCKS.some((other) => other !== block && Math.abs(other.right - block.left) < 0.4);

const DOORS = Object.entries(FLOOR_PLAN_ROOMS).map(([code, box]) => {
  const block = BLOCKS.find((candidate) => box.left >= candidate.left - 0.4 && box.left + box.width <= candidate.right + 0.4);
  const left = block ? opensLeft(block) : false;
  const radius = Math.min(box.height * 0.55, 2.6);
  const hingeY = box.top + box.height - radius * 0.35;
  const hingeX = left ? box.left : box.left + box.width;
  return { code, hingeX, hingeY, radius, left };
});

const Architecture = ({ width, height }: { width: number; height: number }) => {
  const dark = getActiveScheme() === "dark";
  const c = {
    slabFill: dark ? "#141a22" : "#ffffff",
    slabStroke: dark ? "#475569" : "#94a3b8",
    passage: dark ? "rgba(30,41,59,0.5)" : "rgba(241,245,249,0.8)",
    roomFill: dark ? "rgba(30,41,59,0.4)" : "#f8fafc",
    roomStroke: dark ? "#334155" : "#cbd5e1",
    furniture: dark ? "rgba(51,65,85,0.6)" : "rgba(226,232,240,0.8)",
    wall: dark ? "#475569" : "#94a3b8",
    door: dark ? "#475569" : "#cbd5e1",
    doorArc: dark ? "#334155" : "#e2e8f0",
    plant: dark ? "rgba(16,185,129,0.4)" : "rgba(110,231,183,0.7)",
  };

  const decor = (room: SharedRoom) => {
    switch (room.decor) {
      case "seating":
        return Array.from({ length: 6 }, (_, index) => (
          <Rect
            key={`${room.id}-${index}`}
            x={X(room.left + 2.4 + (index % 3) * 5.8)}
            y={Y(room.top + 4.6 + Math.floor(index / 3) * 5)}
            width={X(4.4)}
            height={Y(3.2)}
            rx={5}
            fill={c.furniture}
            stroke={c.roomStroke}
            strokeWidth={1.5}
          />
        ));
      case "table":
        return (
          <G key={room.id} fill={c.furniture} stroke={c.roomStroke} strokeWidth={1.5}>
            <Rect x={X(room.left + room.width / 2 - 1.9)} y={Y(room.top + 3.4)} width={X(3.8)} height={Y(6.6)} rx={6} />
            {Array.from({ length: 8 }, (_, index) => (
              <Rect
                key={index}
                x={X(room.left + room.width / 2 + (index % 2 ? 2.4 : -3.6))}
                y={Y(room.top + 4.1 + Math.floor(index / 2) * 1.6)}
                width={X(1.2)}
                height={Y(1.1)}
                rx={3}
              />
            ))}
          </G>
        );
      case "stairs":
        return (
          <G key={room.id} stroke={c.roomStroke} strokeWidth={1.5} fill="none">
            <Rect x={X(room.left + 1.4)} y={Y(room.top + 3.4)} width={X(5.4)} height={Y(4.6)} />
            {Array.from({ length: 5 }, (_, index) => (
              <Line
                key={index}
                x1={X(room.left + 1.4)}
                y1={Y(room.top + 4.2 + index * 0.78)}
                x2={X(room.left + 6.8)}
                y2={Y(room.top + 4.2 + index * 0.78)}
              />
            ))}
          </G>
        );
      case "lift":
        return (
          <G key={room.id} stroke={c.roomStroke} strokeWidth={1.5} fill="none">
            <Rect x={X(room.left + 0.9)} y={Y(room.top + 3.2)} width={X(3.2)} height={Y(3.6)} />
            <Line x1={X(room.left + 0.9)} y1={Y(room.top + 3.2)} x2={X(room.left + 4.1)} y2={Y(room.top + 6.8)} />
            <Line x1={X(room.left + 4.1)} y1={Y(room.top + 3.2)} x2={X(room.left + 0.9)} y2={Y(room.top + 6.8)} />
          </G>
        );
      default:
        return null;
    }
  };

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${PLAN_W} ${PLAN_H}`} style={StyleSheet.absoluteFill}>
      <Path
        d={`M ${X(4)} ${Y(3)} L ${X(55)} ${Y(3)} L ${X(96)} ${Y(24)} L ${X(96)} ${Y(96)} L ${X(4)} ${Y(96)} Z`}
        fill={c.slabFill}
        stroke={c.slabStroke}
        strokeWidth={7}
        strokeLinejoin="round"
      />
      <Rect
        x={X(PASSAGE_BAND.left)}
        y={Y(PASSAGE_BAND.top)}
        width={X(PASSAGE_BAND.width)}
        height={Y(PASSAGE_BAND.height)}
        fill={c.passage}
      />
      {SHARED_ROOMS.map((room) => (
        <Rect
          key={room.id}
          x={X(room.left)}
          y={Y(room.top)}
          width={X(room.width)}
          height={Y(room.height)}
          rx={4}
          fill={c.roomFill}
          stroke={c.roomStroke}
          strokeWidth={2.5}
        />
      ))}
      {SHARED_ROOMS.map(decor)}
      {BLOCKS.map((block) => (
        <Rect
          key={`${block.left}-${block.top}`}
          x={X(block.left)}
          y={Y(block.top)}
          width={X(block.right - block.left)}
          height={Y(block.bottom - block.top)}
          fill="none"
          stroke={c.wall}
          strokeWidth={4.5}
        />
      ))}
      {DOORS.map((door) => {
        const tipX = door.left ? door.hingeX + door.radius : door.hingeX - door.radius;
        return (
          <G key={door.code} fill="none" strokeWidth={2}>
            <Line x1={X(door.hingeX)} y1={Y(door.hingeY)} x2={X(tipX)} y2={Y(door.hingeY)} stroke={c.door} />
            <Path
              d={`M ${X(tipX)} ${Y(door.hingeY)} A ${X(door.radius)} ${X(door.radius)} 0 0 ${door.left ? 1 : 0} ${X(door.hingeX)} ${Y(door.hingeY) - X(door.radius)}`}
              stroke={c.doorArc}
            />
          </G>
        );
      })}
      {PLANTS.map((plant, index) => (
        <G key={index} fill={c.plant}>
          <Circle cx={X(plant.left)} cy={Y(plant.top)} r={X(0.75)} />
          <Circle cx={X(plant.left + 1.05)} cy={Y(plant.top + 0.35)} r={X(0.62)} />
          <Circle cx={X(plant.left + 0.5)} cy={Y(plant.top + 1.2)} r={X(0.55)} />
        </G>
      ))}
    </Svg>
  );
};

export const FloorLayoutMap = ({
  cabins,
  selectedCode,
  cart,
  matches,
  onSelect,
}: {
  cabins: Cabin[];
  selectedCode: string;
  cart: string[];
  matches: (cabin: Cabin) => boolean;
  onSelect: (cabin: Cabin) => void;
}) => {
  const { width: screenWidth } = useWindowDimensions();
  const [zoom, setZoom] = useState(1);
  const byCode = useMemo(() => new Map(cabins.map((cabin) => [cabin.code, cabin])), [cabins]);

  const planWidth = Math.max(MIN_PLAN_WIDTH, screenWidth - 32) * zoom;
  const planHeight = planWidth / PLAN_RATIO;
  const px = (percent: number, total: number) => (percent / 100) * total;
  const tileFont = zoom >= 1.5 ? 12 : 9;

  return (
    <View style={styles.root}>
      <View style={styles.legend}>
        {STATUS_ORDER.map((status) => (
          <View key={status} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: STATUS_META[status].dot }]} />
            <Text style={styles.legendLabel}>{STATUS_META[status].label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.tools}>
        <BrandButton
          title=""
          icon="remove"
          size="sm"
          variant="secondary"
          disabled={zoom <= 1}
          onPress={() => setZoom((value) => Math.max(1, value - 0.25))}
          accessibilityLabel="Zoom out"
        />
        <Text style={styles.zoomText}>{Math.round(zoom * 100)}%</Text>
        <BrandButton
          title=""
          icon="add"
          size="sm"
          variant="secondary"
          disabled={zoom >= 2.5}
          onPress={() => setZoom((value) => Math.min(2.5, value + 0.25))}
          accessibilityLabel="Zoom in"
        />
        <BrandButton title="Reset view" icon="refresh" size="sm" variant="ghost" onPress={() => setZoom(1)} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator nestedScrollEnabled>
        <View style={{ width: planWidth, height: planHeight }}>
          <Architecture width={planWidth} height={planHeight} />

          {SHARED_ROOMS.map((room) => (
            <View
              key={room.id}
              pointerEvents="none"
              style={[
                styles.roomLabel,
                {
                  left: px(room.left, planWidth),
                  top: px(room.top, planHeight),
                  width: px(room.width, planWidth),
                  height: px(room.height, planHeight),
                },
              ]}
            >
              {room.glyph ? <Text style={styles.roomGlyph}>{room.glyph}</Text> : null}
              {room.icon ? <Glyph name={ROOM_ICONS[room.icon]} size={12} color={brand.textMuted} /> : null}
              <Text style={styles.roomText} numberOfLines={2}>
                {room.label}
              </Text>
            </View>
          ))}

          {PASSAGE_LABEL_X.map((centre) => (
            <Text
              key={centre}
              pointerEvents="none"
              style={[
                styles.passage,
                {
                  left: px(centre, planWidth) - 30,
                  top: px(PASSAGE_BAND.top + PASSAGE_BAND.height / 2, planHeight) - 6,
                },
              ]}
            >
              PASSAGE
            </Text>
          ))}

          {Object.entries(FLOOR_PLAN_ROOMS).map(([code, box]) => {
            const cabin = byCode.get(code);
            if (!cabin) return null;
            return (
              <View
                key={code}
                style={{
                  position: "absolute",
                  left: px(box.left, planWidth),
                  top: px(box.top, planHeight),
                  width: px(box.width, planWidth),
                  height: px(box.height, planHeight),
                  padding: 2,
                }}
              >
                <CabinTile
                  cabin={cabin}
                  variant="plan"
                  fontSize={tileFont}
                  selected={selectedCode === code}
                  inCart={cart.includes(code)}
                  dimmed={!matches(cabin)}
                  onSelect={onSelect}
                />
              </View>
            );
          })}
        </View>
      </ScrollView>
      <Text style={styles.hint}>Swipe sideways to move around the floor.</Text>
    </View>
  );
};

const styles = brandStyles((b) =>
  StyleSheet.create({
    root: {
      gap: 10,
      padding: 10,
      borderWidth: 1,
      borderColor: b.border,
      borderRadius: round.panel,
      backgroundColor: b.surface,
    },
    legend: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
    legendDot: { width: 9, height: 9, borderRadius: 5 },
    legendLabel: { fontSize: t.label, color: b.textSecondary },
    tools: { flexDirection: "row", alignItems: "center", gap: 6 },
    zoomText: { width: 44, textAlign: "center", fontSize: t.label, fontWeight: "600", color: b.textSecondary },
    roomLabel: { position: "absolute", alignItems: "center", justifyContent: "center", gap: 1, paddingHorizontal: 2 },
    roomGlyph: { fontSize: 12, color: b.textMuted },
    roomText: {
      fontSize: 7,
      fontWeight: "700",
      letterSpacing: 0.5,
      textAlign: "center",
      textTransform: "uppercase",
      color: b.textMuted,
    },
    passage: {
      position: "absolute",
      width: 60,
      textAlign: "center",
      fontSize: 7,
      fontWeight: "700",
      letterSpacing: 1.5,
      color: b.placeholder,
    },
    hint: { fontSize: 10.5, color: b.textMuted },
  }),
);
