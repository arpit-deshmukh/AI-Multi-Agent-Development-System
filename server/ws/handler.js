import { provideHumanInput, cancelProject, getRunStatus } from "../services/graphRunner.js";

const projectClients = new Map();

export function initWebSocket(wss) {
  wss.on("connection", (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const projectId = url.searchParams.get("projectId");

    if (!projectId) {
      ws.send(JSON.stringify({ type: "error", message: "Missing projectId query param" }));
      ws.close();
      return;
    }

    if (!projectClients.has(projectId)) {
      projectClients.set(projectId, new Set());
    }
    projectClients.get(projectId).add(ws);

    console.log(`WS connected: project=${projectId} (${projectClients.get(projectId).size} clients)`);

    const status = getRunStatus(projectId);
    if (status) {
      ws.send(JSON.stringify({ type: "status", ...status, timestamp: Date.now() }));
    }

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        handleClientMessage(projectId, msg, ws);
      } catch (e) {
        ws.send(JSON.stringify({ type: "error", message: "Invalid JSON" }));
      }
    });

    ws.on("close", () => {
      const clients = projectClients.get(projectId);
      if (clients) {
        clients.delete(ws);
        if (clients.size === 0) {
          projectClients.delete(projectId);
        }
      }
      console.log(`WS disconnected: project=${projectId}`);
    });

    ws.on("error", (err) => {
      console.error(`WS error for ${projectId}:`, err.message);
    });
  });
}

function handleClientMessage(projectId, msg, ws) {
  switch (msg.type) {
    case "human_response": {
      const delivered = provideHumanInput(projectId, msg.data);
      ws.send(JSON.stringify({
        type: "ack",
        message: delivered ? "Input delivered to agent" : "No pending input request",
        timestamp: Date.now(),
      }));
      break;
    }

    case "cancel": {
      const cancelled = cancelProject(projectId);
      ws.send(JSON.stringify({
        type: "ack",
        message: cancelled ? "Project cancelled" : "No active run found",
        timestamp: Date.now(),
      }));
      break;
    }

    case "ping": {
      ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
      break;
    }

    default:
      ws.send(JSON.stringify({
        type: "error",
        message: `Unknown message type: ${msg.type}`,
      }));
  }
}

export function broadcastToProject(projectId, event) {
  const clients = projectClients.get(projectId);
  if (!clients || clients.size === 0) return;

  const payload = JSON.stringify(event);

  for (const ws of clients) {
    if (ws.readyState === ws.OPEN) {
      ws.send(payload);
    }
  }
}

export function getClientCount(projectId) {
  return projectClients.get(projectId)?.size || 0;
}