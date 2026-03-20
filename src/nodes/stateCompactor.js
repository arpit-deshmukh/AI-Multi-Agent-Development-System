export function stateCompactorNode(state) {
  console.log("\n[State Compactor] Trimming old state...\n");

  const stateStr = JSON.stringify(state);
  const estimatedTokens = Math.ceil(stateStr.length / 4);

  console.log(`State size before: ~${estimatedTokens} tokens`);

  const compactedQueue = { ...state.taskQueue };

  if (compactedQueue.phases) {
    compactedQueue.phases = compactedQueue.phases.map(phase => ({
      ...phase,
      tasks: phase.tasks?.map(task => {
        const status = state.taskStatuses?.[task.taskId];

        if (status === "done") {
          return {
            taskId: task.taskId,
            title: task.title,
            filesToCreate: task.filesToCreate,
            canParallelize: task.canParallelize,
          };
        }

        return task;
      }),
    }));
  }

  const beforeStr = JSON.stringify(state.taskQueue);
  const afterStr = JSON.stringify(compactedQueue);
  const saved = beforeStr.length - afterStr.length;

  const afterTokens = Math.ceil((stateStr.length - saved) / 4);

  console.log(
    `State size after: ~${afterTokens} tokens (saved ~${Math.ceil(saved / 4)} tokens)`
  );

  return {
    taskQueue: compactedQueue,
  };
}