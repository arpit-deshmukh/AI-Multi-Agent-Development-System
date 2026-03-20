export function selectNextTaskNode(state) {
  console.log("\n[Select Next Task] Scanning task queue...\n");

  const { taskQueue, taskStatuses } = state;
  const phases = taskQueue?.phases || [];

  if (phases.length === 0) {
    console.log("No phases in task queue");
    return { currentTask: null, currentPhase: "done" };
  }

  for (const phase of phases) {
    const tasks = phase.tasks || [];

    for (const task of tasks) {
      const status = taskStatuses[task.taskId];

      if (!status || status === "pending") {
        console.log(`Next task: ${task.taskId} — ${task.title}`);
        console.log(`Phase ${phase.phaseNumber}: ${phase.phaseName}`);

        if (task.filesToCreate?.length) {
          task.filesToCreate.forEach(f => console.log(f));
        }

        return {
          currentTask: task,
          currentPhaseIndex: phase.phaseNumber - 1,
          taskStatuses: { [task.taskId]: "in_progress" },
          currentPhase: "dev_loop",
        };
      }
    }

    const allDone = tasks.every(t => taskStatuses[t.taskId] === "done");
    const phaseVerified = taskStatuses[`phase-${phase.phaseNumber}-verified`];

    if (allDone && !phaseVerified) {
      console.log(`Phase ${phase.phaseNumber} (${phase.phaseName}) — all tasks done, needs verification`);

      return {
        currentTask: {
          taskId: `phase-${phase.phaseNumber}-verify`,
          type: "phase_verification",
          phase: phase,
        },
        currentPhase: "phase_verification",
      };
    }
  }

  console.log("ALL TASKS COMPLETE!");

  return {
    currentTask: null,
    currentPhase: "done",
  };
}

export function selectNextTaskRouter(state) {
  if (state.currentPhase === "done") return "presentToUser";
  if (state.currentPhase === "phase_verification") return "phaseVerification";
  if (state.currentTask) return "contextBuilder";
  return "presentToUser";
}