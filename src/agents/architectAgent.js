import { safeCallGemini, callGemini, makeTokenDelta, emptyTokenDelta } from "../utils/gemini.js";

const NAMING_RULES = `
STRICT NAMING CONVENTION (you MUST follow this):
- Table names: snake_case + plural (e.g., "users", "todo_items", "categories")
- DB field names: snake_case (e.g., "created_at", "password_hash", "user_id")
- API paths: kebab-case + plural (e.g., "/api/users", "/api/todo-items")
- relatedTable field: ALWAYS a single table name, NEVER comma-separated
- Foreign key format: "table_name(field)" (e.g., "users(id)")
`;

const STEP1_PROMPT = `You are the Architect Agent in an AI software development team.

ROLE: Senior software architect.
GOAL: Identify ALL entities and their relationships, AND generate a standard naming map.

${NAMING_RULES}

OUTPUT FORMAT (strict JSON):
{
  "entities": [
    {
      "name": "TodoItem",
      "tableName": "todo_items",
      "apiPath": "/api/todo-items",
      "modelFile": "todoItem",
      "routeFile": "todoItemRoutes",
      "description": "A task or todo entry",
      "relationships": [
        { "target": "User", "type": "many-to-one", "foreignKey": "user_id", "description": "Each todo belongs to a user" }
      ]
    }
  ]
}

RULES:
- Always include a "User" entity if auth is required.
- Generate tableName, apiPath, modelFile, routeFile for EVERY entity.
- tableName must be snake_case plural.
- apiPath must be kebab-case plural with /api/ prefix.
- modelFile and routeFile must be camelCase (no extension).`;

export async function architectStep1Node(state) {
  console.log("\n[Architect Step 1/5]\n");

  const result = await safeCallGemini({
    systemPrompt: STEP1_PROMPT,
    userPrompt: `Project Specification:\n${JSON.stringify(state.clarifiedSpec, null, 2)}`,
    agentName: "architectStep1",
    currentCost: state.tokenUsage?.estimatedCost || 0,
    tokenBudget: state.tokenBudget,
  });

  if (!result.ok) {
    console.error(`Architect step 1 failed: ${result.error}`);
    return { error: `Architect step 1 failed: ${result.error}`, tokenUsage: emptyTokenDelta("architectStep1") };
  }

  const entities = result.parsed.entities || result.parsed;
  console.log(`Found ${entities.length} entities`);
  entities.forEach(e => console.log(`${e.name} → ${e.tableName}`));

  return {
    blueprint: { entities },
    tokenUsage: makeTokenDelta("architectStep1", result.tokens),
  };
}

const STEP2_PROMPT = `You are the Architect Agent designing the database schema.

${NAMING_RULES}

CRITICAL: Use the EXACT table names from the entity naming map provided. Do NOT rename tables.

OUTPUT FORMAT (strict JSON):
{
  "databaseType": "PostgreSQL" | "MongoDB",
  "databaseReason": "Why this DB (1 line)",
  "tables": [
    {
      "name": "todo_items",
      "description": "Stores todo entries",
      "fields": [
        { "name": "id", "type": "UUID DEFAULT gen_random_uuid()", "constraints": ["PRIMARY KEY"], "description": "Unique ID" },
        { "name": "title", "type": "VARCHAR(255)", "constraints": ["NOT NULL"], "description": "Todo title" },
        { "name": "user_id", "type": "UUID", "constraints": ["NOT NULL"], "description": "Owner" },
        { "name": "created_at", "type": "TIMESTAMP", "constraints": ["DEFAULT NOW()"], "description": "Created time" },
        { "name": "updated_at", "type": "TIMESTAMP", "constraints": ["DEFAULT NOW()"], "description": "Updated time" }
      ],
      "foreignKeys": [
        { "field": "user_id", "references": "users(id)", "onDelete": "CASCADE" }
      ],
      "indexes": ["user_id"]
    }
  ]
}`;

export async function architectStep2Node(state) {
  console.log("\n[Architect Step 2/5]\n");

  const entityNames = (state.blueprint.entities || []).map(e => ({
    name: e.name, tableName: e.tableName
  }));

  const validationIssues = state.blueprintValidation?.issues || [];
  const fixContext = validationIssues.length > 0
    ? `\n\nPREVIOUS VALIDATION ISSUES:\n${JSON.stringify(validationIssues, null, 2)}`
    : "";

  const result = await safeCallGemini({
    systemPrompt: STEP2_PROMPT,
    userPrompt: `Entity Map:\n${JSON.stringify(entityNames, null, 2)}\n\nEntities:\n${JSON.stringify(state.blueprint.entities, null, 2)}${fixContext}`,
    agentName: "architectStep2",
    currentCost: state.tokenUsage?.estimatedCost || 0,
    tokenBudget: state.tokenBudget,
  });

  if (!result.ok) {
    console.error(`Architect step 2 failed: ${result.error}`);
    return { error: `Architect step 2 failed: ${result.error}`, tokenUsage: emptyTokenDelta("architectStep2") };
  }

  const schema = result.parsed;
  console.log(`DB: ${schema.databaseType}`);

  return {
    blueprint: { dbSchema: schema },
    tokenUsage: makeTokenDelta("architectStep2", result.tokens),
  };
}

const STEP3_PROMPT = `You are the Architect Agent designing REST API endpoints.

${NAMING_RULES}

OUTPUT FORMAT (strict JSON):
{
  "apiEndpoints": [
    {
      "method": "GET",
      "path": "/api/todo-items",
      "requiresAuth": true,
      "relatedTable": "todo_items"
    }
  ]
}`;

export async function architectStep3Node(state) {
  console.log("\n[Architect Step 3/5]\n");

  const result = await safeCallGemini({
    systemPrompt: STEP3_PROMPT,
    userPrompt: JSON.stringify(state.blueprint, null, 2),
    agentName: "architectStep3",
    currentCost: state.tokenUsage?.estimatedCost || 0,
    tokenBudget: state.tokenBudget,
  });

  if (!result.ok) {
    console.error(`Architect step 3 failed: ${result.error}`);
    return { error: `Architect step 3 failed: ${result.error}`, tokenUsage: emptyTokenDelta("architectStep3") };
  }

  return {
    blueprint: { apiEndpoints: result.parsed.apiEndpoints || [] },
    tokenUsage: makeTokenDelta("architectStep3", result.tokens),
  };
}

const STEP4_PROMPT = `You are the Architect Agent designing frontend pages.`;

export async function architectStep4Node(state) {
  console.log("\n[Architect Step 4/5]\n");

  const result = await safeCallGemini({
    systemPrompt: STEP4_PROMPT,
    userPrompt: JSON.stringify(state.blueprint.apiEndpoints, null, 2),
    agentName: "architectStep4",
    currentCost: state.tokenUsage?.estimatedCost || 0,
    tokenBudget: state.tokenBudget,
  });

  if (!result.ok) {
    console.error(`Architect step 4 failed: ${result.error}`);
    return { error: `Architect step 4 failed: ${result.error}`, tokenUsage: emptyTokenDelta("architectStep4") };
  }

  return {
    blueprint: { frontendPages: result.parsed.frontendPages || [] },
    tokenUsage: makeTokenDelta("architectStep4", result.tokens),
  };
}

const STEP5_PROMPT = `You are the Architect Agent generating project structure.`;

export async function architectStep5Node(state) {
  console.log("\n[Architect Step 5/5]\n");

  const result = await safeCallGemini({
    systemPrompt: STEP5_PROMPT,
    userPrompt: JSON.stringify(state.blueprint, null, 2),
    agentName: "architectStep5",
    currentCost: state.tokenUsage?.estimatedCost || 0,
    tokenBudget: state.tokenBudget,
  });

  if (!result.ok) {
    console.error(`Architect step 5 failed: ${result.error}`);
    return { error: `Architect step 5 failed: ${result.error}`, tokenUsage: emptyTokenDelta("architectStep5") };
  }

  return {
    blueprint: {
      folderStructure: result.parsed.folderStructure,
      dependencies: result.parsed.dependencies,
    },
    tokenUsage: makeTokenDelta("architectStep5", result.tokens),
  };
}