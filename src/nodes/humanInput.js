import * as readline from "readline";

function askUserCLI(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function getInputBridge() {
  try {
    const { inputBridges } = await import("../../server/services/graphRunner.js");
    for (const [, bridge] of inputBridges) {
      return bridge;
    }
  } catch (e) {}
  return null;
}

export async function humanInputNode(state) {
  const questions = state.pmQuestions;
  
  if (!questions || questions.length === 0) {
    console.log("No questions to answer. Moving on...");
    return {};
  }

  const bridge = await getInputBridge();

  let answer;

  if (bridge) {
    console.log("Waiting for user response via dashboard...");
    const response = await bridge.waitForInput("pm_clarification", { questions });
    answer = response?.answers || response?.data?.answers || JSON.stringify(response);
    console.log("Got response from dashboard");
  } else {
    console.log("\n" + "═".repeat(60));
    console.log("YOUR INPUT NEEDED");
    console.log("═".repeat(60));
    console.log("\nPlease answer the questions.\n");

    questions.forEach((q, i) => {
      console.log(`${i + 1}. ${q}`);
    });

    console.log("");
    answer = await askUserCLI("Your answers: ");
    console.log("\nGot it.\n");
  }

  return {
    pmConversation: [
      { role: "user", answers: answer },
    ],
    pmStatus: "idle",
  };
}