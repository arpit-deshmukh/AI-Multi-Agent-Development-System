import { safeCallGemini, callGemini, makeTokenDelta, emptyTokenDelta } from "../utils/gemini.js";
import { readFile, getFileList, rollback } from "../utils/sandboxManager.js";

const DEBUGGER_PROMPT = `You are the Debugger Agent in an AI software development team.

ROLE: Expert debugger who reads error messages and identifies root causes.

GOAL: Analyze the error and provide a SPECIFIC fix that the Coder can implement.

OUTPUT FORMAT (strict JSON):
{
  "rootCause": "What exactly is wrong (1-2 lines)",
  "fix": "Specific code change needed",
  "affectedFiles": ["file1.js", "file2.js"],
  "confidence": "high | medium | low"
}

RULES:
- Be SPECIFIC. Not "fix the import" but "change line 5 from 'import X from Y' to 'import { X } from Y'"
- If the error is a missing dependency, say which package to install
- If the error is in a different file than expected, identify which file
- Read the error message carefully — the line number and file path tell you exactly where to look`;

export async function debuggerAgentNode(state) {
  const debugState = state.debugState || { tier: 1, attempts: 0, maxAttempts: 3, rollbackAttempted: false };
  console.log(`\n[Debugger] Tier ${debugState.tier}, Attempt ${debugState.attempts + 1}\n`);

  const { currentTask, executionResult, sandboxId } = state;
  const errors = executionResult?.errors || "Unknown error";

  if (debugState.tier === 2 && debugState.attempts >= 2 && !debugState.rollbackAttempted) {
    console.log("Rollback attempt...");

    const taskStatuses = state.taskStatuses || {};
    const doneTasks = Object.entries(taskStatuses)
      .filter(([_, status]) => status === "done")
      .map(([id]) => id);

    if (doneTasks.length > 0) {
      const lastGoodTag = `v0.${doneTasks.length}.0`;
      const rbResult = rollback(sandboxId, lastGoodTag);

      if (rbResult.success) {
        return {
          debugState: { ...debugState, rollbackAttempted: true, tier: 1, attempts: 0 },
          reviewResult: { verdict: "", issues: [], reviewCycle: 0 },
          executionResult: { result: "", output: "", errors: "" },
        };
      }
    }

    return {
      debugState: { ...debugState, rollbackAttempted: true, tier: 3 },
    };
  }

  if (debugState.tier >= 3 || (debugState.tier === 2 && debugState.attempts >= 2)) {
    return {
      debugState: { ...debugState, tier: 3 },
    };
  }

  let contextFiles = "";

  const failingFiles = currentTask?.filesToCreate || [];
  for (const filePath of failingFiles) {
    try {
      const content = readFile(sandboxId, filePath);
      if (content) contextFiles += `\n--- ${filePath} ---\n${content}\n`;
    } catch (e) {}
  }

  if (debugState.tier >= 2) {
    const allFiles = getFileList(sandboxId);
    const relatedFiles = allFiles.filter(f => {
      const isJS = f.endsWith(".js") || f.endsWith(".jsx");
      const notNodeModules = !f.includes("node_modules");
      const notAlreadyIncluded = !failingFiles.includes(f);
      return isJS && notNodeModules && notAlreadyIncluded;
    }).slice(0, 10);

    for (const filePath of relatedFiles) {
      try {
        const content = readFile(sandboxId, filePath);
        if (content) {
          const truncated = content.split("\n").slice(0, 50).join("\n");
          contextFiles += `\n--- ${filePath} ---\n${truncated}\n`;
        }
      } catch (e) {}
    }
  }

  const userPrompt = `ERROR:\n${errors}\n\nTASK: ${currentTask?.title}\nFILES: ${failingFiles.join(", ")}\n\nCODE:\n${contextFiles}`;

  const result = await safeCallGemini({
    systemPrompt: DEBUGGER_PROMPT,
    userPrompt,
    agentName: "debuggerAgent",
    currentCost: state.tokenUsage?.estimatedCost || 0,
    tokenBudget: state.tokenBudget,
  });

  if (!result.ok) {
    return { error: `debuggerAgent failed: ${result.error}`, tokenUsage: emptyTokenDelta("debuggerAgent") };
  }

  const debug = result.parsed;

  const newAttempts = debugState.attempts + 1;
  const shouldPromoteTier = newAttempts >= debugState.maxAttempts || debug.confidence === "low";
  const newTier = shouldPromoteTier ? debugState.tier + 1 : debugState.tier;

  return {
    debugState: {
      tier: newTier,
      attempts: shouldPromoteTier ? 0 : newAttempts,
      maxAttempts: newTier === 2 ? 2 : 3,
      rollbackAttempted: debugState.rollbackAttempted,
    },
    reviewResult: {
      verdict: "rejected",
      issues: [debug.rootCause, debug.fix],
      reviewCycle: 0,
    },
    tokenUsage: makeTokenDelta("debuggerAgent", result.tokens),
  };
}

export function debuggerRouter(state) {
  if (state.debugState?.tier >= 3) return "humanEscalation";
  return "contextBuilder";
}