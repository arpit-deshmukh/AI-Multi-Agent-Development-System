import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { WebSocketServer } from "ws";

import { initGemini } from "../src/utils/gemini.js";
import projectRoutes from "./routes/projects.js";
import { initWebSocket } from "./ws/handler.js";

const PORT = process.env.SERVER_PORT || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

const app = express();

app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(express.json({ limit: "10mb" }));

app.use((req, res, next) => {
  if (req.path.startsWith("/api")) {
    console.log(`${req.method} ${req.path}`);
  }
  next();
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    version: "1.0.0",
    gemini: !!process.env.GEMINI_API_KEY,
    timestamp: Date.now(),
  });
});

app.use("/api/projects", projectRoutes);

const server = createServer(app);

const wss = new WebSocketServer({
  server,
  path: "/ws",
});

initWebSocket(wss);

async function start() {
  console.log("");
  console.log("AI DEV TEAM — Mission Control Server");
  console.log("Phase 7: Web Dashboard");
  console.log("");

  try {
    initGemini(process.env.GEMINI_API_KEY);
    console.log(`Gemini initialized (model: ${process.env.GEMINI_MODEL || "gemini-2.5-flash"})`);
  } catch (error) {
    console.warn(`Gemini not available: ${error.message}`);
  }

  server.listen(PORT, () => {
    console.log(`REST API: http://localhost:${PORT}/api`);
    console.log(`WebSocket: ws://localhost:${PORT}/ws`);
    console.log(`Frontend: ${FRONTEND_URL}`);
    console.log("");
  });
}

start().catch((error) => {
  console.error("Server failed to start:", error);
  process.exit(1);
});