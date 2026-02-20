const logger = require("../config/logger");

const TRACKED_OPERATIONS = [
  "find",
  "findOne",
  "countDocuments",
  "aggregate",
  "updateOne",
  "updateMany",
  "findOneAndUpdate",
  "deleteOne",
  "deleteMany",
];

const resolveThresholdMs = () => {
  const parsed = Number.parseInt(process.env.SLOW_QUERY_THRESHOLD_MS, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 300;
};

const slowQueryPlugin = (schema) => {
  const thresholdMs = resolveThresholdMs();

  TRACKED_OPERATIONS.forEach((operation) => {
    schema.pre(operation, function markStart() {
      this._queryStartedAt = process.hrtime.bigint();
    });

    schema.post(operation, function reportSlowQuery() {
      if (!this._queryStartedAt) return;

      const durationMs = Number(process.hrtime.bigint() - this._queryStartedAt) / 1e6;
      if (durationMs < thresholdMs) return;

      const modelName = this.model?.modelName || "unknown";
      const filter = typeof this.getQuery === "function" ? this.getQuery() : {};
      const update = typeof this.getUpdate === "function" ? this.getUpdate() : undefined;

      logger.warn({
        model: modelName,
        operation,
        durationMs: Number(durationMs.toFixed(2)),
        filter,
        update,
        message: "Slow Mongo query detected",
      });
    });
  });
};

module.exports = slowQueryPlugin;
