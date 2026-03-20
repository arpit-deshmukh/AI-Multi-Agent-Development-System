import { GoogleGenAI } from "@google/genai";

let aiClient = null;

export function initGemini(apiKey) {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is required");
  }
  aiClient = new GoogleGenAI({ apiKey });
  return aiClient;
}

export function getClient() {
  if (!aiClient) throw new Error("Gemini not initialized");
  return aiClient;
}

function repairTruncatedJSON(text) {
  let cleaned = text.trim();

  let inString = false;
  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (ch === '"' && (i === 0 || cleaned[i - 1] !== '\\')) {
      inString = !inString;
    }
  }

  if (inString) {
    if (cleaned.endsWith("\\")) {
      cleaned += "\\";
    }
    cleaned += '"';
  }

  const stack = [];
  inString = false;

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];

    if (ch === '"' && (i === 0 || cleaned[i - 1] !== '\\')) {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === "{") stack.push("}");
    else if (ch === "[") stack.push("]");
    else if (ch === "}" || ch === "]") stack.pop();
  }

  while (stack.length > 0) {
    cleaned += stack.pop();
  }

  return cleaned;
}

export async function callGemini({
  systemPrompt,
  userPrompt,
  agentName = "unknown",
  currentCost = 0,
  tokenBudget = 2.0,
  model = null,
  maxTokens = null,
}) {
  const client = getClient();
  const modelName = model || process.env.GEMINI_MODEL || "gemini-2.5-flash";

  if (currentCost >= tokenBudget) {
    throw new Error(
      `TOKEN_BUDGET_EXCEEDED: $${currentCost.toFixed(4)} >= $${tokenBudget}`
    );
  }

  const fullPrompt = `${systemPrompt}\n\n---\n\nINPUT:\n${userPrompt}\n\n---\n\nRespond with valid JSON only.`;

  let lastError = null;
  const MAX_RETRIES = 3;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await client.models.generateContent({
        model: modelName,
        contents: fullPrompt,
        config: {
          responseMimeType: "application/json",
          maxOutputTokens: maxTokens || 65536,
        },
      });

      const rawText = response.text || "";

      const finishReason = response.candidates?.[0]?.finishReason;
      const wasTruncated =
        finishReason === "MAX_TOKENS" || finishReason === "STOP" === false;

      if (wasTruncated) {
        console.warn(`[${agentName}] truncated (${finishReason})`);
      }

      const usageMetadata = response.usageMetadata;
      const inputTokens =
        usageMetadata?.promptTokenCount ||
        Math.ceil(fullPrompt.length / 4);
      const outputTokens =
        usageMetadata?.candidatesTokenCount ||
        Math.ceil(rawText.length / 4);

      const cost =
        (inputTokens / 1_000_000) * 0.15 +
        (outputTokens / 1_000_000) * 0.60;

      let parsed;

      try {
        let cleanText = rawText.trim();

        if (cleanText.startsWith("```")) {
          cleanText = cleanText
            .replace(/^```(?:json|JSON|js)?\s*\n?/, "")
            .replace(/\n?\s*```\s*$/, "");
        }

        const firstBrace = cleanText.indexOf("{");
        const firstBracket = cleanText.indexOf("[");
        const startIdx =
          firstBrace === -1
            ? firstBracket
            : firstBracket === -1
            ? firstBrace
            : Math.min(firstBrace, firstBracket);

        if (startIdx > 0) cleanText = cleanText.slice(startIdx);

        const lastBrace = cleanText.lastIndexOf("}");
        const lastBracket = cleanText.lastIndexOf("]");
        const endIdx = Math.max(lastBrace, lastBracket);

        if (endIdx !== -1 && endIdx < cleanText.length - 1) {
          cleanText = cleanText.slice(0, endIdx + 1);
        }

        try {
          parsed = JSON.parse(cleanText);
        } catch {
          const repaired = repairTruncatedJSON(cleanText);

          try {
            parsed = JSON.parse(repaired);
          } catch {
            const filesMatch = cleanText.match(/"files"\s*:\s*\[/);

            if (filesMatch) {
              const filesStart = cleanText.indexOf(filesMatch[0]);
              const arrayStart = cleanText.indexOf("[", filesStart);

              let depth = 0;
              let lastCompleteObj = arrayStart;

              for (let i = arrayStart; i < cleanText.length; i++) {
                if (cleanText[i] === "{") depth++;
                if (cleanText[i] === "}") {
                  depth--;
                  if (depth === 0) lastCompleteObj = i + 1;
                }
              }

              const partialFiles = cleanText.slice(
                arrayStart,
                lastCompleteObj
              );

              const partial = `{"files": ${partialFiles}], "notes": "truncated"}`;
              parsed = JSON.parse(partial);
            } else {
              throw new Error("parse failed");
            }
          }
        }
      } catch (parseError) {
        if (attempt === MAX_RETRIES) {
          throw new Error(`JSON_PARSE_FAILED (${rawText.length})`);
        }
        lastError = parseError;
        continue;
      }

      return {
        parsed,
        raw: rawText,
        tokens: {
          input: inputTokens,
          output: outputTokens,
          cost,
        },
      };
    } catch (error) {
      lastError = error;

      if (error.message?.includes("TOKEN_BUDGET_EXCEEDED")) throw error;
      if (attempt === MAX_RETRIES) throw error;

      const waitMs = Math.pow(2, attempt) * 1000;
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }

  throw lastError;
}

export function makeTokenDelta(agentName, tokens) {
  return {
    newCalls: [
      {
        agent: agentName,
        inputTokens: tokens.input,
        outputTokens: tokens.output,
        timestamp: Date.now(),
      },
    ],
    addedInput: tokens.input,
    addedOutput: tokens.output,
    addedCost: tokens.cost,
  };
}

export function emptyTokenDelta(agentName) {
  return makeTokenDelta(agentName, {
    input: 0,
    output: 0,
    cost: 0,
  });
}

export async function safeCallGemini(options) {
  try {
    const result = await callGemini(options);
    return { ok: true, ...result };
  } catch (error) {
    if (error.message?.includes("TOKEN_BUDGET_EXCEEDED")) throw error;

    console.error(`[${options.agentName}] ${error.message}`);

    return {
      ok: false,
      error: error.message,
      parsed: null,
      raw: "",
      tokens: { input: 0, output: 0, cost: 0 },
    };
  }
}