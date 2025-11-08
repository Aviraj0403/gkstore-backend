import dotenv from "dotenv";
import http from "http";
import app from "./src/app.js";
import connectDB from "./src/config/dbConfig.js";
import { setupSocketIO } from "./src/websocket/socketIO.js";

dotenv.config();

const port = process.env.PORT || 6005;
const startServer = () => {
  const server = http.createServer(app);
  const io = setupSocketIO(server);
  app.set("io", io);  

  server.listen(port, () => {
    console.log(`🚀 Server running at http://localhost:${port}`);
  });

  process.on("SIGINT", () => {
    console.log("Gracefully shutting down...");
    server.close(() => {
      console.log("Closed all HTTP connections");
      process.exit(0);
    });
  });

  process.on("SIGTERM", () => {
    console.log("Gracefully shutting down...");
    server.close(() => {
      console.log("Closed all HTTP connections");
      process.exit(0);
    });
  });
};
const connectWithRetry = () => {
  connectDB()
    .then(() => {
      console.log("✅ MongoDB Connected");
      startServer();
    })
    .catch((err) => {
      console.error("❌ MongoDB connection failed:", err);
      console.log("Retrying connection...");
      setTimeout(connectWithRetry, 5000);
    });
};

connectWithRetry();
