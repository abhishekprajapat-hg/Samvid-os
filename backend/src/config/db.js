const mongoose = require("mongoose");
const logger = require("./logger");
const slowQueryPlugin = require("../utils/mongooseSlowQueryPlugin");

const toPositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const connectDB = async () => {
  try {
    const mongoUri = String(process.env.MONGO_URI || "").trim();
    if (!mongoUri) {
      throw new Error("MONGO_URI is missing. Create backend/.env and set a valid MongoDB URI.");
    }

    const autoIndexEnv = String(process.env.MONGO_AUTO_INDEX || "").trim().toLowerCase();
    const autoIndex = autoIndexEnv ? autoIndexEnv === "true" : true;

    mongoose.plugin(slowQueryPlugin);

    await mongoose.connect(mongoUri, {
      maxPoolSize: toPositiveInt(process.env.MONGO_MAX_POOL_SIZE, 25),
      minPoolSize: toPositiveInt(process.env.MONGO_MIN_POOL_SIZE, 5),
      serverSelectionTimeoutMS: toPositiveInt(
        process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS,
        10000,
      ),
      socketTimeoutMS: toPositiveInt(process.env.MONGO_SOCKET_TIMEOUT_MS, 45000),
      autoIndex,
    });

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
