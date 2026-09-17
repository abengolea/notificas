import { GoogleGenAI } from "@google/genai";
import { geminiApiKey } from "./config";
import type { CrmLlmContent, CrmLlmFunctionCall, CrmLlmPort, CrmLlmTool, CrmLlmTurn } from "./provider";

let client: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  const key = geminiApiKey();
  if (!key) {
    throw new Error("GEMINI_API_KEY missing");
  }
  if (!client) {
    client = new GoogleGenAI({ apiKey: key });
  }
  return client;
}

export function resetGeminiClientForTests(): void {
  client = null;
}

function sanitizeSchema(schema: unknown): Record<string, unknown> {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    return { type: "object", properties: {} };
  }
  const rec = schema as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  if (typeof rec.type === "string") out.type = rec.type;
  else if (rec.properties) out.type = "object";
  if (typeof rec.description === "string") out.description = rec.description;
  if (Array.isArray(rec.enum)) out.enum = rec.enum;
  if (typeof rec.minimum === "number") out.minimum = rec.minimum;
  if (typeof rec.maximum === "number") out.maximum = rec.maximum;
  if (typeof rec.minLength === "number") out.minLength = rec.minLength;
  if (typeof rec.maxLength === "number") out.maxLength = rec.maxLength;
  if (typeof rec.minItems === "number") out.minItems = rec.minItems;
  if (typeof rec.maxItems === "number") out.maxItems = rec.maxItems;
  if (rec.properties && typeof rec.properties === "object" && !Array.isArray(rec.properties)) {
    out.properties = Object.fromEntries(
      Object.entries(rec.properties as Record<string, unknown>).map(([key, value]) => [key, sanitizeSchema(value)]),
    );
  }
  if (Array.isArray(rec.required)) {
    out.required = rec.required.filter((item) => typeof item === "string");
  }
  if (rec.items) out.items = sanitizeSchema(rec.items);
  return out;
}

function wrapResponse(result: unknown): Record<string, unknown> {
  if (result && typeof result === "object" && !Array.isArray(result)) {
    return result as Record<string, unknown>;
  }
  return { result };
}

function toGeminiContents(contents: CrmLlmContent[]) {
  return contents.map((item) => {
    if ("text" in item) {
      return { role: item.role === "model" ? "model" : "user", parts: [{ text: item.text }] };
    }
    if ("functionCalls" in item) {
      return {
        role: "model" as const,
        parts: item.functionCalls.map((call) => ({
          functionCall: {
            id: call.call_id,
            name: call.name,
            args: wrapResponse(call.arguments),
          },
        })),
      };
    }
    return {
      role: "user" as const,
      parts: item.functionResponses.map((res) => ({
        functionResponse: {
          id: res.call_id,
          name: res.name,
          response: wrapResponse(res.result),
        },
      })),
    };
  });
}

function extractCalls(response: {
  functionCalls?: Array<{ id?: string; name?: string; args?: unknown }>;
  candidates?: Array<{ content?: { parts?: Array<{ functionCall?: { id?: string; name?: string; args?: unknown } }> } }>;
}): CrmLlmFunctionCall[] {
  const fromTop = response.functionCalls || [];
  const fromParts =
    response.candidates?.[0]?.content?.parts
      ?.map((part) => part.functionCall)
      .filter((call): call is { id?: string; name?: string; args?: unknown } => Boolean(call)) || [];
  const raw = fromTop.length ? fromTop : fromParts;
  return raw
    .filter((call) => typeof call.name === "string" && call.name.length > 0)
    .map((call, index) => ({
      call_id: String(call.id || `call_${call.name}_${index}`),
      name: String(call.name),
      arguments: call.args ?? {},
    }));
}

export function liveGeminiPort(): CrmLlmPort {
  const sdk = getGeminiClient();
  return {
    async generate(input): Promise<CrmLlmTurn> {
      const response = await sdk.models.generateContent({
        model: input.model,
        contents: toGeminiContents(input.contents),
        config: {
          systemInstruction: input.system,
          tools: [
            {
              functionDeclarations: input.tools.map((tool: CrmLlmTool) => ({
                name: tool.name,
                description: tool.description,
                parametersJsonSchema: sanitizeSchema(tool.parameters),
              })),
            },
          ],
        },
      });
      const usage = response.usageMetadata;
      return {
        text: (response.text || "").trim(),
        functionCalls: extractCalls(response),
        usage: {
          input_tokens: usage?.promptTokenCount,
          output_tokens: usage?.candidatesTokenCount,
          total_tokens: usage?.totalTokenCount,
        },
      };
    },
  };
}
