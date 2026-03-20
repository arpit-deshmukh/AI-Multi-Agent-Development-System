export function printTokenSummary(tokenUsage) {
  if (!tokenUsage || tokenUsage.calls.length === 0) {
    console.log("\nNo LLM calls\n");
    return;
  }

  const byAgent = {};

  for (const call of tokenUsage.calls) {
    if (!byAgent[call.agent]) {
      byAgent[call.agent] = { calls: 0, input: 0, output: 0 };
    }

    byAgent[call.agent].calls++;
    byAgent[call.agent].input += call.inputTokens;
    byAgent[call.agent].output += call.outputTokens;
  }

  console.log("\nToken Usage\n");

  for (const [agent, data] of Object.entries(byAgent)) {
    const cost =
      (data.input / 1_000_000) * 0.15 +
      (data.output / 1_000_000) * 0.60;

    console.log(
      `${agent.padEnd(20)} ${String(data.calls).padStart(2)} calls  $${cost.toFixed(4)}`
    );
  }

  const totalTokens = tokenUsage.totalInput + tokenUsage.totalOutput;
  const totalCost = tokenUsage.estimatedCost;

  console.log(
    `\nTotal: ${tokenUsage.calls.length} calls | ${totalTokens} tokens | $${totalCost.toFixed(4)}\n`
  );
}