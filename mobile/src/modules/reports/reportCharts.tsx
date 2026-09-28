import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Polygon, Polyline, Rect, Text as SvgText } from "react-native-svg";
import { brand, brandStyles, round, type as t } from "../../theme/brand";

/*
 * The report comps' charts, drawn in plain SVG.
 *
 * A charting library would bring a bundle and a theming layer for six figures
 * on four screens; these are small enough to draw exactly as the comps do,
 * including the label positions, which a general-purpose chart would fight.
 */

/** The comps' green ramp, darkest first - donut slices read in this order. */
export const RAMP = ["#0d7a4e", "#2ba96f", "#77cfa6", "#b9e6d0", "#c9d2dc"];

const polar = (cx: number, cy: number, radius: number, angle: number) => {
  const radians = ((angle - 90) * Math.PI) / 180;
  return { x: cx + radius * Math.cos(radians), y: cy + radius * Math.sin(radians) };
};

/* ---------------------------------------------------------------- donut -- */

export type Slice = { label: string; value: number; color?: string };

/*
 * Built from stroked arcs rather than filled wedges: a dash pattern on a
 * circle gives a clean ring with no seam where the wedges meet.
 */
export const Donut = ({
  slices,
  size = 118,
  thickness = 22,
  centreValue,
  centreLabel,
}: {
  slices: Slice[];
  size?: number;
  thickness?: number;
  centreValue?: string;
  centreLabel?: string;
}) => {
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = slices.reduce((sum, slice) => sum + Math.max(0, slice.value), 0) || 1;

  let offset = 0;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={brand.hairline}
          strokeWidth={thickness}
          fill="none"
        />
        {slices.map((slice, index) => {
          const share = Math.max(0, slice.value) / total;
          const length = circumference * share;
          const node = (
            <Circle
              key={slice.label}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={slice.color || RAMP[index % RAMP.length]}
              strokeWidth={thickness}
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={-offset}
              fill="none"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          );
          offset += length;
          return node;
        })}
      </Svg>

      {centreValue ? (
        <View style={styles.donutCentre} pointerEvents="none">
          <Text style={styles.donutValue} numberOfLines={1}>
            {centreValue}
          </Text>
          {centreLabel ? <Text style={styles.donutLabel}>{centreLabel}</Text> : null}
        </View>
      ) : null}
    </View>
  );
};

export const Legend = ({
  slices,
  suffixes,
}: {
  slices: Slice[];
  suffixes: string[];
}) => (
  <View style={styles.legend}>
    {slices.map((slice, index) => (
      <View key={slice.label} style={styles.legendRow}>
        <View style={[styles.legendDot, { backgroundColor: slice.color || RAMP[index % RAMP.length] }]} />
        <Text style={styles.legendLabel} numberOfLines={1}>
          {slice.label}
        </Text>
        <Text style={styles.legendValue}>{suffixes[index]}</Text>
      </View>
    ))}
  </View>
);

/* ----------------------------------------------------------- combo bars -- */

export type ComboPoint = { label: string; a: number; b: number; line?: number };

/** Grouped bars with an optional trend line over them - comp 30's chart. */
export const ComboChart = ({
  points,
  width = 358,
  height = 176,
  tickFormat,
}: {
  points: ComboPoint[];
  width?: number;
  height?: number;
  tickFormat: (value: number) => string;
}) => {
  const padLeft = 38;
  const padBottom = 24;
  const padTop = 8;

  const peak = Math.max(1, ...points.flatMap((point) => [point.a, point.b, point.line || 0]));
  const step = Math.pow(10, Math.floor(Math.log10(peak)));
  const top = Math.ceil(peak / step) * step;

  const plotW = width - padLeft;
  const plotH = height - padBottom - padTop;
  const slot = plotW / Math.max(1, points.length);
  const barW = Math.min(15, slot * 0.28);
  const yOf = (value: number) => padTop + plotH - (value / top) * plotH;
  const xOf = (index: number) => padLeft + slot * index + slot / 2;

  const ticks = [top, top * 0.75, top * 0.5, top * 0.25, 0];
  const hasLine = points.some((point) => point.line != null);
  const linePoints = points.map((point, index) => `${xOf(index)},${yOf(point.line || 0)}`).join(" ");

  return (
    <View>
      <Svg width={width} height={height}>
        {ticks.map((tick) => (
          <Rect key={`g-${tick}`} x={padLeft} y={yOf(tick)} width={plotW} height={0.6} fill={brand.hairline} />
        ))}

        {points.map((point, index) => (
          <React.Fragment key={point.label}>
            <Rect
              x={xOf(index) - barW - 2}
              y={yOf(point.a)}
              width={barW}
              height={Math.max(1, padTop + plotH - yOf(point.a))}
              rx={3}
              fill="#3aab77"
            />
            <Rect
              x={xOf(index) + 2}
              y={yOf(point.b)}
              width={barW}
              height={Math.max(1, padTop + plotH - yOf(point.b))}
              rx={3}
              fill="#fbb6b6"
            />
          </React.Fragment>
        ))}

        {hasLine ? (
          <>
            <Polyline points={linePoints} fill="none" stroke="#0b5d40" strokeWidth={1.8} />
            {points.map((point, index) => (
              <Circle
                key={`d-${point.label}`}
                cx={xOf(index)}
                cy={yOf(point.line || 0)}
                r={4}
                fill={brand.surface}
                stroke="#0b5d40"
                strokeWidth={1.8}
              />
            ))}
          </>
        ) : null}
      </Svg>

      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {ticks.map((tick) => (
          <Text key={`y-${tick}`} style={[styles.axisY, { top: yOf(tick) - 7 }]}>
            {tickFormat(tick)}
          </Text>
        ))}
      </View>

      <View style={[styles.axisX, { paddingLeft: padLeft }]}>
        {points.map((point) => (
          <Text key={`x-${point.label}`} style={styles.axisTick}>
            {point.label}
          </Text>
        ))}
      </View>
    </View>
  );
};

/* ------------------------------------------------------------ area line -- */

/** One filled trend with a callout on the last point - comp 32's chart. */
export const AreaChart = ({
  points,
  width = 358,
  height = 176,
  tickFormat,
  calloutLabel,
}: {
  points: Array<{ label: string; value: number }>;
  width?: number;
  height?: number;
  tickFormat: (value: number) => string;
  calloutLabel?: string;
}) => {
  const padLeft = 44;
  const padBottom = 24;
  const padTop = 20;

  const peak = Math.max(1, ...points.map((point) => point.value));
  const step = Math.pow(10, Math.floor(Math.log10(peak)));
  const top = Math.ceil(peak / step) * step;

  const plotW = width - padLeft - 8;
  const plotH = height - padBottom - padTop;
  const yOf = (value: number) => padTop + plotH - (value / top) * plotH;
  const xOf = (index: number) => padLeft + (plotW / Math.max(1, points.length - 1)) * index;

  const ticks = [top, top * 0.75, top * 0.5, top * 0.25, 0];
  const line = points.map((point, index) => `${xOf(index)},${yOf(point.value)}`).join(" ");
  const area = `${padLeft},${padTop + plotH} ${line} ${xOf(points.length - 1)},${padTop + plotH}`;
  const last = points[points.length - 1];

  return (
    <View>
      <Svg width={width} height={height}>
        {ticks.map((tick) => (
          <Line
            key={`g-${tick}`}
            x1={padLeft}
            y1={yOf(tick)}
            x2={padLeft + plotW}
            y2={yOf(tick)}
            stroke={brand.hairline}
            strokeWidth={0.8}
            strokeDasharray="3 4"
          />
        ))}

        <Polygon points={area} fill="#d9f0e4" />
        <Polyline points={line} fill="none" stroke="#12845a" strokeWidth={2.2} />

        {points.map((point, index) => (
          <Circle
            key={`d-${point.label}`}
            cx={xOf(index)}
            cy={yOf(point.value)}
            r={index === points.length - 1 ? 5 : 4}
            fill={index === points.length - 1 ? brand.surface : "#12845a"}
            stroke="#12845a"
            strokeWidth={2}
          />
        ))}
      </Svg>

      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {ticks.map((tick) => (
          <Text key={`y-${tick}`} style={[styles.axisYWide, { top: yOf(tick) - 7 }]}>
            {tickFormat(tick)}
          </Text>
        ))}
        {calloutLabel && last ? (
          <View style={[styles.callout, { left: Math.min(width - 84, xOf(points.length - 1) - 40), top: Math.max(0, yOf(last.value) - 34) }]}>
            <Text style={styles.calloutText}>{calloutLabel}</Text>
          </View>
        ) : null}
      </View>

      <View style={[styles.axisX, { paddingLeft: padLeft - 12 }]}>
        {points.map((point) => (
          <Text key={`x-${point.label}`} style={styles.axisTick}>
            {point.label}
          </Text>
        ))}
      </View>
    </View>
  );
};

/* ----------------------------------------------------------- multi line -- */

/** Two series with the value printed above each point - comp 33's chart. */
export const MultiLineChart = ({
  points,
  width = 340,
  height = 172,
}: {
  points: Array<{ label: string; sub?: string; a: number; b: number }>;
  width?: number;
  height?: number;
}) => {
  const padLeft = 26;
  const padBottom = 30;
  const padTop = 22;

  const peak = Math.max(1, ...points.flatMap((point) => [point.a, point.b]));
  const top = Math.ceil(peak / 10) * 10;
  const plotW = width - padLeft - 10;
  const plotH = height - padBottom - padTop;
  const yOf = (value: number) => padTop + plotH - (value / top) * plotH;
  const xOf = (index: number) => padLeft + (plotW / Math.max(1, points.length - 1)) * index;

  const ticks = [top, top * 0.666, top * 0.333, 0];
  const lineA = points.map((point, index) => `${xOf(index)},${yOf(point.a)}`).join(" ");
  const lineB = points.map((point, index) => `${xOf(index)},${yOf(point.b)}`).join(" ");
  const areaA = `${padLeft},${padTop + plotH} ${lineA} ${xOf(points.length - 1)},${padTop + plotH}`;

  return (
    <View>
      <Svg width={width} height={height}>
        {ticks.map((tick) => (
          <Rect key={`g-${tick}`} x={padLeft} y={yOf(tick)} width={plotW} height={0.6} fill={brand.hairline} />
        ))}

        <Polygon points={areaA} fill="#e2f3ea" />
        <Polyline points={lineA} fill="none" stroke="#0f7a52" strokeWidth={2} />
        <Polyline points={lineB} fill="none" stroke="#8ed6b4" strokeWidth={2} />

        {points.map((point, index) => (
          <React.Fragment key={point.label}>
            <Circle cx={xOf(index)} cy={yOf(point.a)} r={3.6} fill="#0f7a52" />
            <Circle cx={xOf(index)} cy={yOf(point.b)} r={3.6} fill="#8ed6b4" />
            <SvgText
              x={xOf(index)}
              y={yOf(point.a) - 8}
              fontSize={10}
              fontWeight="700"
              fill={brand.text}
              textAnchor="middle"
            >
              {String(point.a)}
            </SvgText>
            <SvgText
              x={xOf(index)}
              y={yOf(point.b) - 8}
              fontSize={10}
              fontWeight="700"
              fill={brand.textSecondary}
              textAnchor="middle"
            >
              {String(point.b)}
            </SvgText>
          </React.Fragment>
        ))}
      </Svg>

      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {ticks.map((tick) => (
          <Text key={`y-${tick}`} style={[styles.axisYNarrow, { top: yOf(tick) - 7 }]}>
            {Math.round(tick)}
          </Text>
        ))}
      </View>

      <View style={[styles.axisX, { paddingLeft: padLeft - 14 }]}>
        {points.map((point) => (
          <View key={`x-${point.label}`} style={styles.tickCol}>
            <Text style={styles.axisTick}>{point.label}</Text>
            {point.sub ? <Text style={styles.axisSubTick}>{point.sub}</Text> : null}
          </View>
        ))}
      </View>
    </View>
  );
};

/* --------------------------------------------------------------- funnel -- */

export const Funnel = ({
  stages,
}: {
  stages: Array<{ label: string; value: number; share: number }>;
}) => {
  const peak = Math.max(1, ...stages.map((stage) => stage.value));
  return (
    <View style={styles.funnel}>
      {stages.map((stage, index) => (
        <View key={stage.label} style={styles.funnelRow}>
          <Text style={styles.funnelLabel} numberOfLines={1}>
            {stage.label}
          </Text>
          <View style={styles.funnelTrack}>
            <View
              style={[
                styles.funnelFill,
                {
                  width: `${Math.max(4, (stage.value / peak) * 100)}%`,
                  backgroundColor: RAMP[Math.min(index, RAMP.length - 2)],
                },
              ]}
            />
          </View>
          <Text style={styles.funnelValue}>{stage.value}</Text>
          <Text style={styles.funnelShare}>{stage.share}%</Text>
        </View>
      ))}
    </View>
  );
};

/* ------------------------------------------------------------- bar list -- */

export const BarList = ({
  rows,
}: {
  rows: Array<{ label: string; value: number; display: string }>;
}) => {
  const peak = Math.max(1, ...rows.map((row) => row.value));
  return (
    <View style={styles.barList}>
      {rows.map((row) => (
        <View key={row.label} style={styles.barRow}>
          <Text style={styles.barLabel} numberOfLines={1}>
            {row.label}
          </Text>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${Math.max(4, (row.value / peak) * 100)}%` }]} />
          </View>
          <Text style={styles.barValue} numberOfLines={1}>
            {row.display}
          </Text>
        </View>
      ))}
    </View>
  );
};

const styles = brandStyles((b) =>
  StyleSheet.create({
    donutCentre: {
      ...StyleSheet.absoluteFillObject,
      alignItems: "center",
      justifyContent: "center",
    },
    donutValue: {
      fontSize: t.cardTitle,
      fontWeight: "700",
      color: b.text,
    },
    donutLabel: {
      fontSize: t.micro,
      color: b.textMuted,
    },

    legend: { flex: 1, minWidth: 0, gap: 10 },
    legendRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    legendDot: {
      width: 9,
      height: 9,
      borderRadius: round.pill,
    },
    legendLabel: {
      flex: 1,
      minWidth: 0,
      fontSize: t.tagline,
      color: b.text,
    },
    legendValue: {
      fontSize: t.tagline,
      fontWeight: "700",
      color: b.text,
    },

    axisY: {
      position: "absolute",
      left: 0,
      width: 34,
      textAlign: "right",
      fontSize: t.micro,
      color: b.textMuted,
    },
    axisYWide: {
      position: "absolute",
      left: 0,
      width: 38,
      textAlign: "right",
      fontSize: t.micro,
      color: b.textMuted,
    },
    axisYNarrow: {
      position: "absolute",
      left: 0,
      width: 20,
      textAlign: "right",
      fontSize: t.micro,
      color: b.textMuted,
    },
    axisX: {
      flexDirection: "row",
      marginTop: -18,
    },
    tickCol: { flex: 1, alignItems: "center" },
    axisTick: {
      flex: 1,
      textAlign: "center",
      fontSize: t.tagline,
      color: b.textSecondary,
    },
    axisSubTick: {
      fontSize: 8,
      color: b.textMuted,
    },

    callout: {
      position: "absolute",
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: round.field,
      backgroundColor: "#0b5d40",
    },
    calloutText: {
      fontSize: t.body,
      fontWeight: "700",
      color: b.onPrimary,
    },

    funnel: { gap: 11 },
    funnelRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
    },
    funnelLabel: {
      width: 52,
      fontSize: t.tagline,
      color: b.textSecondary,
    },
    funnelTrack: {
      flex: 1,
      minWidth: 0,
      height: 17,
      borderRadius: round.button,
      overflow: "hidden",
      backgroundColor: b.hairline,
    },
    funnelFill: { height: "100%", borderRadius: round.button },
    funnelValue: {
      width: 18,
      textAlign: "right",
      fontSize: t.tagline,
      fontWeight: "700",
      color: b.text,
    },
    funnelShare: {
      width: 28,
      textAlign: "right",
      fontSize: t.micro,
      color: b.textMuted,
    },

    barList: { gap: 12 },
    barRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
    },
    barLabel: {
      width: 60,
      fontSize: t.tagline,
      color: b.textSecondary,
    },
    barTrack: {
      flex: 1,
      minWidth: 0,
      height: 15,
      borderRadius: round.button,
      overflow: "hidden",
      backgroundColor: b.hairline,
    },
    barFill: { height: "100%", borderRadius: round.button, backgroundColor: "#fb8b8b" },
    barValue: {
      width: 44,
      textAlign: "right",
      fontSize: t.tagline,
      fontWeight: "700",
      color: b.text,
    },
  }),
);
