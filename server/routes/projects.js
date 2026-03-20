import { Router } from "express";
import {
  startProject,
  resumeProject,
  getRunStatus,
  getActiveRuns,
  cancelProject,
} from "../services/graphRunner.js";
import { broadcastToProject } from "../ws/handler.js";
import { buildGraph, createCheckpointer } from "../../src/config/graph.js";
import { getSandboxInfo, getFileList, readFile } from "../../src/utils/sandboxManager.js";

const router = Router();

router.post("/", async (req, res) => {
  try {
    const { requirement, tokenBudget } = req.body;

    if (!requirement || typeof requirement !== "string" || requirement.trim().length === 0) {
      return res.status(400).json({ error: "requirement is required" });
    }

    const projectId = `project-${Date.now()}`;
    const emit = (event) => broadcastToProject(projectId, event);

    const result = await startProject(projectId, requirement.trim(), emit, {
      tokenBudget: tokenBudget || 2.0,
    });

    res.status(201).json({
      projectId: result.projectId,
      threadId: result.threadId,
      status: "running",
      message: "Project started. Connect to WebSocket for real-time updates.",
      wsUrl: `/ws?projectId=${result.projectId}`,
    });
  } catch (error) {
    console.error("Error starting project:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/", (req, res) => {
  const runs = getActiveRuns();
  res.json({ projects: runs });
});

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const runStatus = getRunStatus(id);

    const checkpointer = await createCheckpointer();
    const graph = buildGraph({ checkpointer });
    const config = { configurable: { thread_id: id } };

    let state = null;
    try {
      const savedState = await graph.getState(config);
      state = savedState?.values || null;
    } catch (e) {}

    res.json({
      projectId: id,
      active: !!runStatus,
      runStatus: runStatus || null,
      state: state ? _summarizeState(state) : null,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/:id/resume", async (req, res) => {
  try {
    const { id } = req.params;

    if (getRunStatus(id)) {
      return res.status(409).json({ error: "Project is already running" });
    }

    const emit = (event) => broadcastToProject(id, event);
    const result = await resumeProject(id, emit);

    res.json({
      projectId: result.projectId,
      status: "resumed",
      wsUrl: `/ws?projectId=${result.projectId}`,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/:id/cancel", (req, res) => {
  const cancelled = cancelProject(req.params.id);
  res.json({
    cancelled,
    message: cancelled ? "Project cancelled" : "No active run found",
  });
});

router.get("/:id/sandbox", async (req, res) => {
  try {
    const { id } = req.params;

    const checkpointer = await createCheckpointer();
    const graph = buildGraph({ checkpointer });
    const config = { configurable: { thread_id: id } };

    const savedState = await graph.getState(config);
    const sandboxId = savedState?.values?.sandboxId;

    if (!sandboxId) {
      return res.status(404).json({ error: "No sandbox found for this project" });
    }

    const info = getSandboxInfo(sandboxId);
    let files = [];
    try {
      files = getFileList(sandboxId);
    } catch (e) {}

    res.json({
      sandboxId,
      info,
      fileCount: files.length,
      files: files.slice(0, 100),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/:id/files/*", async (req, res) => {
  try {
    const { id } = req.params;
    const filePath = req.params[0];

    const checkpointer = await createCheckpointer();
    const graph = buildGraph({ checkpointer });
    const config = { configurable: { thread_id: id } };

    const savedState = await graph.getState(config);
    const sandboxId = savedState?.values?.sandboxId;

    if (!sandboxId) {
      return res.status(404).json({ error: "No sandbox" });
    }

    const content = readFile(sandboxId, filePath);
    if (content === null) {
      return res.status(404).json({ error: "File not found" });
    }

    res.json({ path: filePath, content });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function _summarizeState(state) {
  return {
    userRequirement: state.userRequirement,
    currentPhase: state.currentPhase,
    pmStatus: state.pmStatus,
    hasSpec: !!state.clarifiedSpec,
    hasBlueprint: !!state.blueprint?.entities?.length,
    blueprintValid: state.blueprintValidation?.isValid,
    taskPhases: state.taskQueue?.phases?.length || 0,
    totalTasks: state.taskQueue?.phases?.reduce((sum, p) => sum + (p.tasks?.length || 0), 0) || 0,
    currentPhaseIndex: state.currentPhaseIndex,
    currentTaskIndex: state.currentTaskIndex,
    currentTask: state.currentTask?.title || null,
    taskStatuses: state.taskStatuses,
    sandboxId: state.sandboxId,
    sandboxHealthy: state.sandboxHealthy,
    fileRegistryCount: state.fileRegistry?.length || 0,
    tokenUsage: state.tokenUsage,
    error: state.error,
  };
}

export default router;