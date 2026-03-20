import { StateGraph, START, END, MemorySaver } from "@langchain/langgraph";
import { AgentState } from "../config/state.js";

import { pmAgentNode } from "../agents/pmAgent.js";
import { humanInputNode } from "../nodes/humanInput.js";

import {
  architectStep1Node, architectStep2Node, architectStep3Node,
  architectStep4Node, architectStep5Node,
} from "../agents/architectAgent.js";
import { blueprintValidatorNode, blueprintValidatorRouter } from "../agents/blueprintValidator.js";

import { plannerAgentNode } from "../agents/plannerAgent.js";
import { setupSandboxNode } from "../nodes/setupSandbox.js";
import { sandboxHealthCheckNode, sandboxHealthRouter } from "../nodes/sandboxHealthCheck.js";

import { selectNextTaskNode, selectNextTaskRouter } from "../nodes/selectNextTask.js";
import { contextBuilderNode } from "../nodes/contextBuilder.js";
import { coderAgentNode } from "../agents/coderAgent.js";
import { updateRegistryNode } from "../nodes/updateRegistry.js";
import { reviewerAgentNode, reviewerRouter } from "../agents/reviewerAgent.js";
import { executorAgentNode, executorRouter } from "../agents/executorAgent.js";
import { snapshotManagerNode } from "../nodes/snapshotManager.js";
import { debuggerAgentNode, debuggerRouter } from "../agents/debuggerAgent.js";
import { simplifyTaskNode } from "../nodes/simplifyTask.js";
import { humanEscalationNode, humanEscalationRouter } from "../nodes/humanEscalation.js";
import { phaseVerificationNode, phaseVerificationRouter } from "../nodes/phaseVerification.js";
import { patternExtractorNode } from "../nodes/patternExtractor.js";
import { stateCompactorNode } from "../nodes/stateCompactor.js";
import { presentToUserNode } from "../nodes/presentToUser.js";
import { deploymentVerifierNode, deploymentVerifierRouter } from "../nodes/deploymentVerifier.js";

export function buildGraph(options = {}) {
  const { checkpointer } = options;
  const graph = new StateGraph(AgentState);

  graph.addNode("pmAgent", pmAgentNode);
  graph.addNode("humanInput", humanInputNode);

  graph.addNode("architectStep1", architectStep1Node);
  graph.addNode("architectStep2", architectStep2Node);
  graph.addNode("architectStep3", architectStep3Node);
  graph.addNode("architectStep4", architectStep4Node);
  graph.addNode("architectStep5", architectStep5Node);
  graph.addNode("blueprintValidator", blueprintValidatorNode);

  graph.addNode("plannerAgent", plannerAgentNode);
  graph.addNode("setupSandbox", setupSandboxNode);
  graph.addNode("sandboxHealthCheck", sandboxHealthCheckNode);

  graph.addNode("selectNextTask", selectNextTaskNode);
  graph.addNode("contextBuilder", contextBuilderNode);
  graph.addNode("coderAgent", coderAgentNode);
  graph.addNode("updateRegistry", updateRegistryNode);
  graph.addNode("reviewerAgent", reviewerAgentNode);
  graph.addNode("executorAgent", executorAgentNode);
  graph.addNode("snapshotManager", snapshotManagerNode);
  graph.addNode("debuggerAgent", debuggerAgentNode);
  graph.addNode("simplifyTask", simplifyTaskNode);
  graph.addNode("humanEscalation", humanEscalationNode);
  graph.addNode("phaseVerification", phaseVerificationNode);
  graph.addNode("patternExtractor", patternExtractorNode);
  graph.addNode("stateCompactor", stateCompactorNode);
  graph.addNode("presentToUser", presentToUserNode);
  graph.addNode("deploymentVerifier", deploymentVerifierNode);

  graph.addEdge(START, "pmAgent");

  graph.addConditionalEdges("pmAgent", (state) => {
    if (state.pmStatus === "needs_clarification") return "humanInput";
    if (state.pmStatus === "spec_ready") return "architectStep1";
    return END;
  });

  graph.addEdge("humanInput", "pmAgent");

  graph.addEdge("architectStep1", "architectStep2");
  graph.addEdge("architectStep2", "architectStep3");
  graph.addEdge("architectStep3", "architectStep4");
  graph.addEdge("architectStep4", "architectStep5");
  graph.addEdge("architectStep5", "blueprintValidator");

  graph.addConditionalEdges("blueprintValidator", blueprintValidatorRouter, {
    __end__: "plannerAgent",
    architectStep2: "architectStep2",
    architectStep3: "architectStep3",
    architectStep4: "architectStep4",
  });

  graph.addEdge("plannerAgent", "setupSandbox");
  graph.addEdge("setupSandbox", "sandboxHealthCheck");

  graph.addConditionalEdges("sandboxHealthCheck", sandboxHealthRouter, {
    __end__: "selectNextTask",
    setupSandbox: "setupSandbox",
  });

  graph.addConditionalEdges("selectNextTask", selectNextTaskRouter, {
    contextBuilder: "contextBuilder",
    phaseVerification: "phaseVerification",
    presentToUser: "deploymentVerifier",
  });

  graph.addEdge("contextBuilder", "coderAgent");
  graph.addEdge("coderAgent", "updateRegistry");
  graph.addEdge("updateRegistry", "reviewerAgent");

  graph.addConditionalEdges("reviewerAgent", reviewerRouter, {
    executorAgent: "executorAgent",
    contextBuilder: "contextBuilder",
    simplifyTask: "simplifyTask",
  });

  graph.addConditionalEdges("executorAgent", executorRouter, {
    snapshotManager: "snapshotManager",
    debuggerAgent: "debuggerAgent",
  });

  graph.addEdge("snapshotManager", "selectNextTask");

  graph.addConditionalEdges("debuggerAgent", debuggerRouter, {
    contextBuilder: "contextBuilder",
    humanEscalation: "humanEscalation",
  });

  graph.addConditionalEdges("humanEscalation", humanEscalationRouter, {
    selectNextTask: "selectNextTask",
    contextBuilder: "contextBuilder",
    simplifyTask: "simplifyTask",
  });

  graph.addEdge("simplifyTask", "selectNextTask");

  graph.addConditionalEdges("phaseVerification", phaseVerificationRouter, {
    patternExtractor: "patternExtractor",
  });

  graph.addEdge("patternExtractor", "stateCompactor");
  graph.addEdge("stateCompactor", "selectNextTask");

  graph.addEdge("presentToUser", END);

  graph.addConditionalEdges("deploymentVerifier", deploymentVerifierRouter, {
    presentToUser: "presentToUser",
    debuggerAgent: "debuggerAgent",
  });

  const saver = checkpointer || new MemorySaver();
  const compiled = graph.compile({ checkpointer: saver });

  console.log("Graph compiled");
  return compiled;
}

export async function createCheckpointer() {
  const redisUrl = process.env.REDIS_URL;

  if (redisUrl) {
    const { ensureRedis } = await import("../utils/redisDocker.js");
    const redisReady = ensureRedis(redisUrl);

    if (redisReady) {
      try {
        const { RedisSaver } = await import("@langchain/langgraph-checkpoint-redis");
        const saver = await RedisSaver.fromUrl(redisUrl);
        console.log("Redis checkpointer connected");
        return saver;
      } catch (error) {
        console.warn(`Redis connection failed: ${error.message}`);
        console.warn("Falling back to in-memory checkpointer");
      }
    } else {
      console.warn("Redis not available. Using in-memory checkpointer.");
    }
  } else {
    console.log("No REDIS_URL. Using in-memory checkpointer.");
  }

  return new MemorySaver();
}