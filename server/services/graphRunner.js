import { buildGraph, createCheckpointer } from "../../src/config/graph.js";
import { initGemini } from "../../src/utils/gemini.js";

const activeRuns = new Map();

class InputBridge {
  constructor() {
    this._resolver = null;
    this._pendingType = null;
    this._pendingPayload = null;
    this._emitFn = null;
  }

  setEmitFn(fn) {
    this._emitFn = fn;
  }

  waitForInput(type, payload) {
    this._pendingType = type;
    this._pendingPayload = payload;

    if (this._emitFn) {
      this._emitFn({
        type: "human_input_needed",
        inputType: type,
        questions: payload?.questions || [],
        task: payload?.task || null,
        error: payload?.error || null,
        timestamp: Date.now(),
      });
    }

    return new Promise((resolve) => {
      this._resolver = resolve;
    });
  }

  provideInput(data) {
    if (this._resolver) {
      const resolver = this._resolver;
      this._resolver = null;
      this._pendingType = null;
      this._pendingPayload = null;
      resolver(data);
    }
  }

  get isPending() {
    return this._resolver !== null;
  }

  get pendingType() {
    return this._pendingType;
  }

  get pendingPayload() {
    return this._pendingPayload;
  }
}

export const inputBridges = new Map();

export async function startProject(projectId, requirement, emit, options = {}) {
  const { tokenBudget = 2.0 } = options;

  try {
    initGemini(process.env.GEMINI_API_KEY);
  } catch (e) {}

  const checkpointer = await createCheckpointer();
  const graph = buildGraph({ checkpointer });

  const threadId = projectId;

  const inputBridge = new InputBridge();
  inputBridge.setEmitFn(emit);
  inputBridges.set(projectId, inputBridge);

  const abortController = new AbortController();

  activeRuns.set(projectId, {
    threadId,
    inputBridge,
    abortController,
    graph,
    status: "running",
    startedAt: Date.now(),
  });

  const config = {
    configurable: { thread_id: threadId },
    recursionLimit: 500,
  };

  _executeGraph(projectId, graph, config, requirement, tokenBudget, emit)
    .catch((error) => {
      emit({
        type: "error",
        message: error.message,
        timestamp: Date.now(),
      });
    })
    .finally(() => {
      activeRuns.delete(projectId);
      inputBridges.delete(projectId);
    });

  return { projectId, threadId };
}

export async function resumeProject(projectId, emit) {
  const checkpointer = await createCheckpointer();
  const graph = buildGraph({ checkpointer });

  const inputBridge = new InputBridge();
  inputBridge.setEmitFn(emit);
  inputBridges.set(projectId, inputBridge);

  const abortController = new AbortController();

  activeRuns.set(projectId, {
    threadId: projectId,
    inputBridge,
    abortController,
    graph,
    status: "running",
    startedAt: Date.now(),
  });

  const config = {
    configurable: { thread_id: projectId },
    recursionLimit: 500,
  };

  _executeGraph(projectId, graph, config, null, null, emit)
    .catch((error) => {
      emit({ type: "error", message: error.message, timestamp: Date.now() });
    })
    .finally(() => {
      activeRuns.delete(projectId);
      inputBridges.delete(projectId);
    });

  return { projectId, threadId: projectId };
}

async function _executeGraph(projectId, graph, config, requirement, tokenBudget, emit) {
  emit({
    type: "run_started",
    projectId,
    timestamp: Date.now(),
  });

  const input = requirement
    ? { userRequirement: requirement, tokenBudget: tokenBudget || 2.0 }
    : null;

  try {
    const stream = await graph.stream(input, {
      ...config,
      streamMode: "updates",
    });

    for await (const event of stream) {
      const nodeName = Object.keys(event)[0];
      const nodeOutput = event[nodeName];

      if (activeRuns.get(projectId)?.abortController?.signal?.aborted) {
        emit({ type: "run_cancelled", projectId, timestamp: Date.now() });
        return;
      }

      emit({
        type: "node_complete",
        node: nodeName,
        data: _sanitizeForTransport(nodeOutput),
        timestamp: Date.now(),
      });

      _emitDerivedEvents(nodeName, nodeOutput, emit);
    }

    const finalState = await graph.getState(config);

    emit({
      type: "run_complete",
      projectId,
      finalState: _sanitizeForTransport(finalState?.values || {}),
      timestamp: Date.now(),
    });

  } catch (error) {
    if (error.name === "AbortError") {
      emit({ type: "run_cancelled", projectId, timestamp: Date.now() });
    } else {
      emit({
        type: "error",
        message: error.message,
        recoverable: !error.message?.includes("TOKEN_BUDGET_EXCEEDED"),
        timestamp: Date.now(),
      });

      try {
        const currentState = await graph.getState(config);
        if (currentState?.values) {
          emit({
            type: "error_state",
            currentPhase: currentState.values.currentPhase,
            currentTask: currentState.values.currentTask?.title,
            sandboxId: currentState.values.sandboxId,
            timestamp: Date.now(),
          });
        }
      } catch (_) {}
    }
  }
}

function _emitDerivedEvents(nodeName, output, emit) {
  if (output.pmStatus === "needs_clarification" && output.pmQuestions?.length) {
    emit({
      type: "human_input_needed",
      inputType: "pm_clarification",
      questions: output.pmQuestions,
      timestamp: Date.now(),
    });
  }

  if (output.clarifiedSpec) {
    emit({
      type: "spec_ready",
      spec: output.clarifiedSpec,
      timestamp: Date.now(),
    });
  }

  if (output.blueprint) {
    emit({
      type: "blueprint_update",
      blueprint: output.blueprint,
      timestamp: Date.now(),
    });
  }

  if (output.blueprintValidation) {
    emit({
      type: "validation_result",
      validation: output.blueprintValidation,
      timestamp: Date.now(),
    });
  }

  if (output.taskQueue?.phases?.length) {
    emit({
      type: "taskqueue_ready",
      taskQueue: output.taskQueue,
      timestamp: Date.now(),
    });
  }

  if (output.sandboxId) {
    emit({
      type: "sandbox_created",
      sandboxId: output.sandboxId,
      healthy: output.sandboxHealthy,
      timestamp: Date.now(),
    });
  }

  if (output.currentTask) {
    emit({
      type: "task_started",
      task: output.currentTask,
      timestamp: Date.now(),
    });
  }

  if (output.taskStatuses) {
    emit({
      type: "task_progress",
      statuses: output.taskStatuses,
      timestamp: Date.now(),
    });
  }

  if (output.coderOutput) {
    emit({
      type: "code_written",
      files: output.coderOutput,
      timestamp: Date.now(),
    });
  }

  if (output.reviewResult?.verdict) {
    emit({
      type: "review_result",
      review: output.reviewResult,
      timestamp: Date.now(),
    });
  }

  if (output.executionResult?.result) {
    emit({
      type: "execution_result",
      execution: output.executionResult,
      timestamp: Date.now(),
    });
  }

  if (output.tokenUsage) {
    emit({
      type: "token_update",
      usage: output.tokenUsage,
      timestamp: Date.now(),
    });
  }

  if (output.currentPhase) {
    emit({
      type: "phase_change",
      phase: output.currentPhase,
      timestamp: Date.now(),
    });
  }

  if (nodeName === "humanEscalation") {
    emit({
      type: "human_input_needed",
      inputType: "escalation",
      task: output.currentTask,
      error: output.executionResult?.errors,
      timestamp: Date.now(),
    });
  }
}

function _sanitizeForTransport(obj) {
  try {
    return JSON.parse(JSON.stringify(obj, (key, value) => {
      if (typeof value === "string" && value.length > 5000) {
        return value.substring(0, 500) + `... [truncated, ${value.length} chars]`;
      }
      return value;
    }));
  } catch {
    return { error: "Could not serialize state" };
  }
}

export function provideHumanInput(projectId, data) {
  const bridge = inputBridges.get(projectId);
  if (bridge?.isPending) {
    bridge.provideInput(data);
    return true;
  }
  return false;
}

export function cancelProject(projectId) {
  const run = activeRuns.get(projectId);
  if (run) {
    run.abortController.abort();
    run.status = "cancelled";
    return true;
  }
  return false;
}

export function getRunStatus(projectId) {
  const run = activeRuns.get(projectId);
  if (!run) return null;
  return {
    projectId,
    threadId: run.threadId,
    status: run.status,
    startedAt: run.startedAt,
    waitingForInput: run.inputBridge.isPending,
    inputType: run.inputBridge.pendingType,
  };
}

export function getActiveRuns() {
  const runs = [];
  for (const [id, run] of activeRuns) {
    runs.push({
      projectId: id,
      status: run.status,
      startedAt: run.startedAt,
      waitingForInput: run.inputBridge.isPending,
    });
  }
  return runs;
}