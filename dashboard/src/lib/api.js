const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }

  return data;
}

export async function createProject(requirement, tokenBudget = 2.0) {
  return request("/projects", {
    method: "POST",
    body: JSON.stringify({ requirement, tokenBudget }),
  });
}

export async function listProjects() {
  return request("/projects");
}

export async function getProject(projectId) {
  return request(`/projects/${projectId}`);
}

export async function resumeProject(projectId) {
  return request(`/projects/${projectId}/resume`, { method: "POST" });
}

export async function cancelProject(projectId) {
  return request(`/projects/${projectId}/cancel`, { method: "POST" });
}

export async function getSandbox(projectId) {
  return request(`/projects/${projectId}/sandbox`);
}

export async function readFile(projectId, filePath) {
  return request(`/projects/${projectId}/files/${filePath}`);
}

export async function healthCheck() {
  return request("/health");
}