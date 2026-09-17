import { crmAiEnabled } from "../flags";

export const DEFAULT_GEMINI_CRM_MODEL = "gemini-2.0-flash";
export const CRM_AI_MAX_TOOL_ROUNDS = 8;
export const CRM_AI_HISTORY_MESSAGES = 12;
export const CRM_AI_RATE_PER_MINUTE = 20;

export function geminiApiKey(): string | null {
  const key = (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GENAI_API_KEY ||
    ""
  ).trim();
  return key || null;
}

export function geminiCrmModel(): string {
  return (process.env.GEMINI_CRM_MODEL || DEFAULT_GEMINI_CRM_MODEL).trim() || DEFAULT_GEMINI_CRM_MODEL;
}

export function geminiCrmFastModel(): string {
  return (process.env.GEMINI_CRM_MODEL_FAST || geminiCrmModel()).trim();
}

export function crmAssistantConfigured(): boolean {
  return crmAiEnabled() && Boolean(geminiApiKey());
}

export type CrmAiStatus = {
  enabled: boolean;
  configured: boolean;
  model: string;
  provider: "gemini";
};

export function crmAiStatus(): CrmAiStatus {
  return {
    enabled: crmAiEnabled(),
    configured: Boolean(geminiApiKey()),
    model: geminiCrmModel(),
    provider: "gemini",
  };
}
