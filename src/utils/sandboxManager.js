import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const sandboxes = new Map();
const NETWORK_NAME = "aidev-network";

let dockerAvailable = false;
try {
  execSync("docker info", { stdio: "pipe", timeout: 5000 });
  dockerAvailable = true;
} catch {
  console.warn("Docker not available");
}

function dockerExec(containerId, command, timeout = 30000) {
  try {
    const stdout = execSync(
      `docker exec ${containerId} sh -c '${command.replace(/'/g, "'\\''")}'`,
      { encoding: "utf-8", timeout, stdio: "pipe" }
    );
    return { stdout: stdout || "", stderr: "", exitCode: 0 };
  } catch (error) {
    return {
      stdout: error.stdout || "",
      stderr: error.stderr || error.message,
      exitCode: error.status || 1,
    };
  }
}

function ensureNetwork() {
  try {
    execSync(`docker network inspect ${NETWORK_NAME}`, { stdio: "pipe" });
  } catch {
    execSync(`docker network create ${NETWORK_NAME}`, { stdio: "pipe" });
  }
}

function waitForContainer(containerId, checkCmd, maxAttempts = 20) {
  for (let i = 0; i < maxAttempts; i++) {
    const result = dockerExec(containerId, checkCmd, 5000);
    if (result.exitCode === 0) return true;
    execSync("sleep 1");
  }
  return false;
}

export async function createSandbox(folderStructure, dependencies, dbSchema) {
  const sandboxId = `sandbox-${Date.now()}`;
  const sandboxBase =
    process.env.SANDBOX_DIR || path.join(process.cwd(), "sandboxes");
  const sandboxPath = path.join(sandboxBase, sandboxId);

  fs.mkdirSync(sandboxPath, { recursive: true });

  const backendPath = path.join(sandboxPath, "backend");
  const frontendPath = path.join(sandboxPath, "frontend");

  fs.mkdirSync(backendPath, { recursive: true });
  fs.mkdirSync(frontendPath, { recursive: true });

  const backendDirs = [
    "src",
    "src/models",
    "src/routes",
    "src/middleware",
    "src/config",
    "src/utils",
  ];

  const frontendDirs = [
    "src",
    "src/pages",
    "src/components",
    "src/hooks",
    "src/context",
    "src/utils",
  ];

  backendDirs.forEach((d) =>
    fs.mkdirSync(path.join(backendPath, d), { recursive: true })
  );
  frontendDirs.forEach((d) =>
    fs.mkdirSync(path.join(frontendPath, d), { recursive: true })
  );

  if (typeof folderStructure === "string") {
    for (const line of folderStructure.split("\n")) {
      const match = line.match(/(?:├──|└──|│\s+[├└]──|\s+)\s*(.+)/);
      if (match) {
        const item = match[1].trim().replace(/\/$/, "");
        if (item && !item.includes(".") && item.length < 100) {
          try {
            fs.mkdirSync(path.join(sandboxPath, item), {
              recursive: true,
            });
          } catch {}
        }
      }
    }
  }

  if (dependencies?.backend) {
    fs.writeFileSync(
      path.join(backendPath, "package.json"),
      JSON.stringify(
        {
          name: dependencies.backend.name || "backend",
          version: "1.0.0",
          type: "module",
          main: "src/index.js",
          scripts: {
            start: "node src/index.js",
            dev: "nodemon src/index.js",
          },
          dependencies: dependencies.backend.dependencies || {},
          devDependencies: dependencies.backend.devDependencies || {},
        },
        null,
        2
      )
    );
  }

  if (dependencies?.frontend) {
    fs.writeFileSync(
      path.join(frontendPath, "package.json"),
      JSON.stringify(
        {
          name: dependencies.frontend.name || "frontend",
          version: "1.0.0",
          type: "module",
          scripts: {
            dev: "vite",
            build: "vite build",
            preview: "vite preview",
          },
          dependencies: dependencies.frontend.dependencies || {},
          devDependencies: dependencies.frontend.devDependencies || {},
        },
        null,
        2
      )
    );
  }

  const dbType = dependencies?.backend?.dependencies?.mongoose
    ? "mongo"
    : "postgres";

  const dbContainerName = `aidev-db-${sandboxId}`;
  const backendContainerName = `aidev-backend-${sandboxId}`;
  const frontendContainerName = `aidev-frontend-${sandboxId}`;
  const volumeName = `aidev-dbdata-${sandboxId}`;

  const dbUrl =
    dbType === "mongo"
      ? `mongodb://${dbContainerName}:27017/appdb`
      : `postgresql://postgres:postgres@${dbContainerName}:5432/appdb`;

  fs.writeFileSync(
    path.join(backendPath, ".env"),
    [
      "PORT=5000",
      `DATABASE_URL=${dbUrl}`,
      "JWT_SECRET=dev-secret-change-in-production",
      "NODE_ENV=development",
    ].join("\n") + "\n"
  );

  fs.writeFileSync(
    path.join(frontendPath, ".env"),
    [`VITE_API_URL=http://localhost:5000/api`].join("\n") + "\n"
  );

  fs.writeFileSync(
    path.join(sandboxPath, ".gitignore"),
    ["node_modules/", ".env", "dist/", ".DS_Store", "*.log"].join("\n") + "\n"
  );

  try {
    execSync("git init", { cwd: sandboxPath, stdio: "pipe" });
    execSync("git add -A", { cwd: sandboxPath, stdio: "pipe" });
    execSync('git commit -m "init" --allow-empty', {
      cwd: sandboxPath,
      stdio: "pipe",
    });
    execSync("git tag v0.0.0", { cwd: sandboxPath, stdio: "pipe" });
  } catch {}

  let dbContainerId = null;
  let backendContainerId = null;
  let frontendContainerId = null;

  if (dockerAvailable) {
    try {
      ensureNetwork();

      if (dbType === "mongo") {
        dbContainerId = execSync(
          [
            "docker run -d",
            `--name ${dbContainerName}`,
            `--network ${NETWORK_NAME}`,
            `-v ${volumeName}:/data/db`,
            "-e MONGO_INITDB_DATABASE=appdb",
            "mongo:7",
          ].join(" "),
          { encoding: "utf-8", stdio: "pipe" }
        ).trim();

        waitForContainer(
          dbContainerId,
          "mongosh --eval 'db.runCommand({ping:1})' --quiet",
          30
        );
      } else {
        dbContainerId = execSync(
          [
            "docker run -d",
            `--name ${dbContainerName}`,
            `--network ${NETWORK_NAME}`,
            `-v ${volumeName}:/var/lib/postgresql/data`,
            "-e POSTGRES_USER=postgres",
            "-e POSTGRES_PASSWORD=postgres",
            "-e POSTGRES_DB=appdb",
            "postgres:16-alpine",
          ].join(" "),
          { encoding: "utf-8", stdio: "pipe" }
        ).trim();

        waitForContainer(dbContainerId, "pg_isready -U postgres", 30);
      }

      backendContainerId = execSync(
        [
          "docker run -d",
          `--name ${backendContainerName}`,
          `--network ${NETWORK_NAME}`,
          `-v "${sandboxPath}:/app"`,
          "-w /app",
          `-e DATABASE_URL=${dbUrl}`,
          "node:20-slim",
          "tail -f /dev/null",
        ].join(" "),
        { encoding: "utf-8", stdio: "pipe" }
      ).trim();

      dockerExec(
        backendContainerId,
        "cd /app/backend && npm install 2>&1",
        120000
      );

      frontendContainerId = execSync(
        [
          "docker run -d",
          `--name ${frontendContainerName}`,
          `--network ${NETWORK_NAME}`,
          `-v "${sandboxPath}:/app"`,
          "-w /app",
          "node:20-slim",
          "tail -f /dev/null",
        ].join(" "),
        { encoding: "utf-8", stdio: "pipe" }
      ).trim();

      dockerExec(
        frontendContainerId,
        "cd /app/frontend && npm install 2>&1",
        120000
      );
    } catch {}
  }

  sandboxes.set(sandboxId, {
    path: sandboxPath,
    backendPath,
    frontendPath,
    dbType,
    dbContainerId,
    backendContainerId,
    frontendContainerId,
    dbContainerName,
    backendContainerName,
    frontendContainerName,
    createdAt: Date.now(),
    snapshotCount: 0,
  });

  return sandboxId;
}