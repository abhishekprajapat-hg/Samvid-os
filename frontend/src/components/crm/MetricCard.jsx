import React from "react";
import StatCard from "./StatCard";

/**
 * Thin wrapper kept so existing callers do not have to move. New code should
 * use StatCard directly; this maps the old prop names onto it.
 *
 * title -> label, trend + trendLabel -> delta { direction, label }.
 */
const MetricCard = ({
  title,
  value,
  helper,
  icon,
  trend,
  trendLabel,
  onClick,
  className,
}) => (
  <StatCard
    label={title}
    value={value}
    helper={helper}
    icon={icon}
    delta={trendLabel ? { direction: trend, label: trendLabel } : undefined}
    onClick={onClick}
    className={className}
  />
);

export default MetricCard;
