import { getFileList } from "../utils/sandboxManager.js";
import { assembleBackendEntry, assembleFrontendEntry } from "./assembleEntryPoints.js";

export function phaseVerificationNode(state) {
  console.log("\n[Phase Verification] Checking phase integrity...\n");

  const { currentTask, sandboxId, fileRegistry, blueprint } = state;
  const phase = currentTask?.phase;

  if (!phase) {
    console.log("No phase info");
    return { taskStatuses: {} };
  }

  const errors = [];
  const outputs = [];

  const phaseTasks = phase.tasks || [];
  const allFiles = sandboxId ? getFileList(sandboxId) : [];

  for (const task of phaseTasks) {
    for (const filePath of (task.filesToCreate || [])) {
      if (allFiles.includes(filePath)) {
        outputs.push(`+ ${filePath} exists`);
      } else {
        const dir = filePath.split("/").slice(0, -1).join("/");
        const base = filePath.split("/").pop().toLowerCase();

        const fuzzy = allFiles.find(f => {
          const fDir = f.split("/").slice(0, -1).join("/");
          const fBase = f.split("/").pop().toLowerCase();
          return (
            fDir === dir &&
            (
              fBase.includes(base.replace(".js", "").replace(".jsx", "")) ||
              base.includes(fBase.replace(".js", "").replace(".jsx", ""))
            )
          );
        });

        if (fuzzy) {
          outputs.push(`~ ${filePath} → found as ${fuzzy}`);
        } else {
          errors.push(`Missing: ${filePath} (from task ${task.taskId})`);
        }
      }
    }
  }

  const phaseName = phase.phaseName?.toLowerCase() || "";

  if (phaseName.includes("backend") || phaseName.includes("route") || phaseName.includes("api")) {
    console.log("Assembling backend entry point...");
    try {
      assembleBackendEntry(sandboxId, fileRegistry || [], blueprint);
    } catch (e) {
      console.warn(`Assembly warning: ${e.message}`);
    }
  }

  if (phaseName.includes("frontend") || phaseName.includes("page") || phaseName.includes("ui")) {
    console.log("Assembling frontend entry point...");
    try {
      assembleFrontendEntry(sandboxId, fileRegistry || [], blueprint);
    } catch (e) {
      console.warn(`Assembly warning: ${e.message}`);
    }
  }

  if (phaseName.includes("integration") || phaseName.includes("deploy")) {
    console.log("Final assembly of entry points...");
    try {
      assembleBackendEntry(sandboxId, fileRegistry || [], blueprint);
      assembleFrontendEntry(sandboxId, fileRegistry || [], blueprint);
    } catch (e) {
      console.warn(`Assembly warning: ${e.message}`);
    }
  }

  const passed = errors.length === 0;

  console.log(`Phase ${phase.phaseNumber} (${phase.phaseName}): ${passed ? "PASSED" : "FAILED"}`);
  outputs.forEach(o => console.log(o));
  errors.forEach(e => console.log(`- ${e}`));

  return {
    taskStatuses: {
      [`phase-${phase.phaseNumber}-verified`]: passed ? "done" : "failed"
    },
  };
}

export function phaseVerificationRouter(state) {
  return "patternExtractor";
}