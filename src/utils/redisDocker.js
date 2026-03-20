import { execSync } from "child_process";

const CONTAINER_NAME = "aidev-redis";
const VOLUME_NAME = "aidev-redis-data";

export function ensureRedis(redisUrl) {
  const portMatch = redisUrl?.match(/:(\d+)/);
  const port = portMatch ? portMatch[1] : "6379";

  try {
    execSync("docker info", { stdio: "pipe", timeout: 5000 });
  } catch {
    console.warn("Docker not available");
    return false;
  }

  try {
    const status = execSync(
      `docker inspect -f '{{.State.Running}}' ${CONTAINER_NAME} 2>/dev/null`,
      { encoding: "utf-8", stdio: "pipe" }
    ).trim();

    if (status === "true") {
      if (waitForPong()) {
        console.log("Redis running");
        return true;
      }
    }
  } catch {}

  try {
    execSync(`docker start ${CONTAINER_NAME}`, {
      stdio: "pipe",
      timeout: 10000,
    });

    if (waitForPong()) {
      console.log("Redis restarted");
      return true;
    }
  } catch {}

  try {
    console.log("Starting Redis...");
    execSync(
      `docker run -d --name ${CONTAINER_NAME} -p ${port}:6379 -v ${VOLUME_NAME}:/data redis/redis-stack-server:latest`,
      { stdio: "pipe", timeout: 60000 }
    );

    if (waitForPong()) {
      console.log("Redis started");
      return true;
    }

    console.warn("Redis not responding");
    return false;
  } catch (error) {
    console.warn(`Failed to start Redis: ${error.message}`);
    return false;
  }
}

function waitForPong() {
  for (let i = 0; i < 10; i++) {
    try {
      const result = execSync(
        `docker exec ${CONTAINER_NAME} redis-cli ping`,
        { encoding: "utf-8", stdio: "pipe", timeout: 3000 }
      ).trim();

      if (result === "PONG") return true;
    } catch {}

    execSync("sleep 0.5");
  }
  return false;
}