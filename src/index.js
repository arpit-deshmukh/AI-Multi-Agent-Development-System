import "dotenv/config";
import * as readline from "readline";
import { initGemini } from "./utils/gemini.js";
import { printTokenSummary } from "./utils/tokenTracker.js";
import { buildGraph, createCheckpointer } from "./config/graph.js";

function askUser(question) {
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

function printBanner() {
  console.log("\nAI DEV TEAM\n");
}

function printSpec(spec) {
  console.log("\n" + "=".repeat(60));
  console.log("FINAL PROJECT SPECIFICATION");
  console.log("=".repeat(60));
  console.log(JSON.stringify(spec, null, 2));
  console.log("=".repeat(60));
}

function printBlueprint(blueprint, validation) {
  console.log("\n" + "=".repeat(60));
  console.log("ARCHITECTURE BLUEPRINT");
  console.log("=".repeat(60));

  if (blueprint.entities?.length) {
    console.log(`\nEntities (${blueprint.entities.length})`);
    blueprint.entities.forEach((e) => {
      console.log(`- ${e.name} ${e.description || ""}`);
    });
  }

  if (blueprint.dbSchema?.tables?.length) {
    console.log(
      `\nDatabase: ${blueprint.dbSchema.databaseType} (${blueprint.dbSchema.tables.length})`
    );
    blueprint.dbSchema.tables.forEach((t) => {
      console.log(`- ${t.name} (${t.fields?.length || 0})`);
    });
  }

  if (blueprint.apiEndpoints?.length) {
    console.log(`\nAPI Endpoints (${blueprint.apiEndpoints.length})`);
    blueprint.apiEndpoints.forEach((e) => {
      console.log(`- ${e.method?.padEnd(7)} ${e.path}`);
    });
  }

  if (blueprint.frontendPages?.length) {
    console.log(`\nFrontend Pages (${blueprint.frontendPages.length})`);
    blueprint.frontendPages.forEach((p) => {
      console.log(`- ${p.route?.padEnd(20)} ${p.name}`);
    });
  }

  if (blueprint.folderStructure) {
    console.log(`\nFolder Structure`);
    const lines =
      typeof blueprint.folderStructure === "string"
        ? blueprint.folderStructure.split("\n")
        : [JSON.stringify(blueprint.folderStructure)];

    lines.slice(0, 25).forEach((l) => console.log(`  ${l}`));
    if (lines.length > 25) {
      console.log(`  ... (${lines.length - 25} more lines)`);
    }
  }

  if (validation) {
    console.log(
      `\nValidation: ${validation.isValid ? "PASSED" : "FAILED"} (${validation.validationCycles})`
    );

    if (validation.issues?.length) {
      validation.issues.forEach((i) => {
        console.log(`- ${i.message}`);
      });
    }
  }

  console.log("\n" + "=".repeat(60));
}

async function main() {
  printBanner();

  try {
    initGemini(process.env.GEMINI_API_KEY);
    console.log(
      `Gemini initialized (${process.env.GEMINI_MODEL || "gemini-2.5-flash"})`
    );
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }

  const checkpointer = await createCheckpointer();
  const graph = buildGraph({ checkpointer });

  const args = process.argv.slice(2);
  const resumeIndex = args.indexOf("--resume");

  let isResume = false;
  let threadId;
  let requirement;

  if (resumeIndex !== -1) {
    threadId = args[resumeIndex + 1];
    if (!threadId) process.exit(1);

    isResume = true;
    requirement = "";

    console.log(`Resuming ${threadId}`);
  } else {
    requirement = args.join(" ");

    if (!requirement) {
      requirement = await askUser("Your idea: ");
    }

    if (!requirement) process.exit(0);

    threadId = `project-${Date.now()}`;

    console.log(`Requirement: "${requirement}"`);
    console.log(`Thread: ${threadId}`);
  }

  const config = {
    configurable: { thread_id: threadId },
    recursionLimit: 500,
  };

  try {
    let finalState;

    if (isResume) {
      const savedState = await graph.getState(config);

      if (savedState?.values?.sandboxId) {
        const { reconnectSandbox } = await import(
          "./utils/sandboxManager.js"
        );

        const ok = await reconnectSandbox(savedState.values.sandboxId);
        if (!ok) process.exit(1);
      }

      finalState = await graph.invoke(null, config);
    } else {
      finalState = await graph.invoke(
        {
          userRequirement: requirement,
          tokenBudget: parseFloat(process.env.TOKEN_BUDGET || "2.0"),
        },
        config
      );
    }

    if (finalState.clarifiedSpec) {
      printSpec(finalState.clarifiedSpec);
    }

    if (finalState.blueprint?.entities?.length) {
      printBlueprint(
        finalState.blueprint,
        finalState.blueprintValidation
      );
    }

    if (finalState.taskQueue?.phases?.length) {
      console.log("\n" + "=".repeat(60));
      console.log("BUILD PLAN");
      console.log("=".repeat(60));

      for (const phase of finalState.taskQueue.phases) {
        console.log(
          `\nPhase ${phase.phaseNumber}: ${phase.phaseName}`
        );

        phase.tasks?.forEach((t) => {
          console.log(`- ${t.taskId}: ${t.title}`);
          t.filesToCreate?.forEach((f) => console.log(`  ${f}`));
        });
      }

      console.log("=".repeat(60));
    }

    if (finalState.sandboxId) {
      console.log(`\nSandbox: ${finalState.sandboxId}`);

      try {
        const { getFileList } = await import(
          "./utils/sandboxManager.js"
        );
        const files = getFileList(finalState.sandboxId);

        console.log(`Files: ${files.length}`);
        files.slice(0, 15).forEach((f) => console.log(`- ${f}`));
      } catch {}
    }

    if (
      !finalState.clarifiedSpec &&
      !finalState.blueprint?.entities?.length
    ) {
      console.log("No output");
    }

    printTokenSummary(finalState.tokenUsage);
  } catch (error) {
    if (error.message?.includes("TOKEN_BUDGET_EXCEEDED")) {
      console.error("Token budget exceeded");
    } else {
      console.error(error.message);
      if (process.env.DEBUG) console.error(error.stack);
    }
    process.exit(1);
  }
}

main().catch(console.error);