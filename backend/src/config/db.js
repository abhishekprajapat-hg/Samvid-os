const mongoose = require("mongoose");
const dns = require("dns");
const logger = require("./logger");
const slowQueryPlugin = require("../utils/mongooseSlowQueryPlugin");

const toPositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const toNonNegativeInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const sleep = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const resolveMongoDnsServers = () =>
  String(process.env.MONGO_DNS_SERVERS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

const resolveMongoIpFamily = () => {
  const parsed = Number.parseInt(process.env.MONGO_IP_FAMILY, 10);
  if (parsed === 4 || parsed === 6) return parsed;
  return null;
};

const connectDB = async () => {
  try {
    const autoIndexEnv = String(process.env.MONGO_AUTO_INDEX || "").trim().toLowerCase();
    const autoIndex = autoIndexEnv ? autoIndexEnv === "true" : true;
    const retryDelayMs = toPositiveInt(process.env.MONGO_CONNECT_RETRY_DELAY_MS, 3000);
    const maxRetries = toNonNegativeInt(process.env.MONGO_CONNECT_MAX_RETRIES, 0);
    const dnsServers = resolveMongoDnsServers();
    const mongoIpFamily = resolveMongoIpFamily();

    mongoose.plugin(slowQueryPlugin);

    if (dnsServers.length) {
      try {
        dns.setServers(dnsServers);
        logger.info({
          dnsServers,
          message: "Custom DNS servers applied for MongoDB SRV resolution",
        });
      } catch (error) {
        logger.warn({
          dnsServers,
          error: error.message,
          message: "Failed to apply custom DNS servers",
        });
      }
    }

    if (mongoIpFamily) {
      logger.info({
        family: mongoIpFamily,
        message: "MongoDB IP family preference applied",
      });
    }

    let attempts = 0;
    while (true) {
      attempts += 1;
      try {
        const connectionOptions = {
          maxPoolSize: toPositiveInt(process.env.MONGO_MAX_POOL_SIZE, 25),
          minPoolSize: toPositiveInt(process.env.MONGO_MIN_POOL_SIZE, 1),
          connectTimeoutMS: toPositiveInt(process.env.MONGO_CONNECT_TIMEOUT_MS, 10000),
          serverSelectionTimeoutMS: toPositiveInt(
            process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS,
            10000,
          ),
          socketTimeoutMS: toPositiveInt(process.env.MONGO_SOCKET_TIMEOUT_MS, 45000),
          autoIndex,
        };

        if (mongoIpFamily) {
          connectionOptions.family = mongoIpFamily;
        }

        await mongoose.connect(process.env.MONGO_URI, {
          ...connectionOptions,
        });
        break;
      } catch (error) {
        const hasRetryLimit = maxRetries > 0;
        const canRetry = !hasRetryLimit || attempts < maxRetries;
        logger.error({
          attempt: attempts,
          maxRetries: hasRetryLimit ? maxRetries : "infinite",
          error: error.message,
          message: "MongoDB connection attempt failed",
        });

        if (!canRetry) {
          throw error;
        }

        await sleep(retryDelayMs);
      }
    }

    logger.info({ message: "MongoDB connected" });

    mongoose.connection.on("error", (error) => {
      logger.error({ error: error.message, message: "MongoDB connection error" });
    });
  } catch (error) {
    logger.error({ error: error.message, message: "DB connection failed" });
    process.exit(1);
  }
};

module.exports = connectDB;
