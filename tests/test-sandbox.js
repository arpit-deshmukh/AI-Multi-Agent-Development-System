import {
  createSandbox, healthCheck, writeFile, readFile,
  executeCommand, snapshot, rollback, getFileList,
  getSandboxPath, getSandboxInfo, destroySandbox,
} from "../src/utils/sandboxManager.js";

console.log("\nTEST: Sandbox Manager (Docker-Powered)\n");

let passed = 0, failed = 0;
function assert(c, m) {
  if (c) {
    console.log(`  PASS ${m}`);
    passed++;
  } else {
    console.log(`  FAIL ${m}`);
    failed++;
  }
}

async function runTest() {
  let sandboxId;

  try {
    console.log("  Test 1: Create Sandbox\n");

    sandboxId = await createSandbox(
      "backend/src/models\nbackend/src/routes\nfrontend/src/pages",
      {
        backend: {
          name: "test-backend",
          dependencies: { express: "^4.18.2", cors: "^2.8.5" },
          devDependencies: {},
        },
        frontend: {
          name: "test-frontend",
          dependencies: { react: "^18.2.0" },
          devDependencies: { vite: "^5.0.0" },
        },
      }
    );

    assert(sandboxId && sandboxId.startsWith("sandbox-"), `Sandbox created: ${sandboxId}`);

    const info = getSandboxInfo(sandboxId);
    console.log(`\n  Docker enabled: ${info?.dockerEnabled}`);
    console.log(`  Container: ${info?.containerId || "none"}`);

    console.log("\n  Test 2: Health Check\n");

    const health = await healthCheck(sandboxId);
    assert(health.healthy === true, "Health check passed");
    if (!health.healthy) {
      console.log("  Failures:", health.failures);
    }
    console.log(`  Docker enabled: ${health.dockerEnabled}`);

    console.log("\n  Test 3: Write/Read Files\n");

    writeFile(sandboxId, "backend/src/index.js", `
import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log("Server running on port " + PORT));
`);

    const content = readFile(sandboxId, "backend/src/index.js");
    assert(content.includes("express"), "File content correct");

    console.log("\n  Test 4: Execute Commands\n");

    const nodeVersion = executeCommand(sandboxId, "node --version");
    console.log(`  Node version: ${nodeVersion.stdout.trim()}`);
    assert(nodeVersion.exitCode === 0, `Node available (${nodeVersion.stdout.trim()})`);

    if (info?.dockerEnabled) {
      const expressCheck = executeCommand(sandboxId, "ls /app/backend/node_modules/express/package.json 2>/dev/null");
      assert(expressCheck.exitCode === 0, "Express installed in container");

      const syntaxCheck = executeCommand(sandboxId, "node --check /app/backend/src/index.js");
      assert(syntaxCheck.exitCode === 0, "index.js syntax valid in Docker");
    }

    console.log("\n  Test 5: Git Snapshot & Rollback\n");

    const snap1 = snapshot(sandboxId, "Added server");
    assert(snap1.success, `Snapshot: ${snap1.tag}`);

    writeFile(sandboxId, "backend/src/models/User.js", 'export class User {}');
    const snap2 = snapshot(sandboxId, "Added User model");
    assert(snap2.success, `Snapshot: ${snap2.tag}`);

    const rb = rollback(sandboxId, snap1.tag);
    assert(rb.success, `Rollback to ${snap1.tag}`);

    console.log("\n  Test 6: File Listing\n");

    const files = getFileList(sandboxId);
    assert(files.length > 0, `Found ${files.length} files`);
    assert(files.some(f => f.includes("package.json")), "Has package.json");
    assert(files.some(f => f.includes("docker-compose")), "Has docker-compose.yml");

    console.log("\n  Test 7: Destroy Sandbox\n");

    destroySandbox(sandboxId);
    assert(getSandboxPath(sandboxId) === null, "Sandbox destroyed (files + container)");
    sandboxId = null;

  } catch (error) {
    console.error(`\n  FAIL ${error.message}`);
    console.error(error.stack);
    if (sandboxId) {
      console.log("  Cleaning up...");
      destroySandbox(sandboxId);
    }
  }

  console.log(`\n  Summary: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

runTest();