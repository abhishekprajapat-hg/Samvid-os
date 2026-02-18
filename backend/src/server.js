require("dotenv").config();
const http = require("http");
const { Server } = require("socket.io");
const app = require("./app");
const connectDB = require("./config/db");
const { registerChatSocketHandlers } = require("./socket/chat.socket");

connectDB();

const PORT = process.env.PORT || 5000;

const httpServer = http.createServer(app);
const configuredOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const io = new Server(httpServer, {
  cors: {
    origin: configuredOrigins.length ? configuredOrigins : "*",
    methods: ["GET", "POST"],
    credentials: configuredOrigins.length > 0,
  },
});

app.set("io", io);
registerChatSocketHandlers(io);

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
