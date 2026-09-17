export { geminiApiKey, geminiCrmModel, crmAiStatus, crmAssistantConfigured } from "./config";
export { CRM_ASSISTANT_INSTRUCTIONS } from "./instructions";
export { runCrmAssistantTurn } from "./loop";
export type { MarketingAIContext, CrmAiTurnResult, CrmAiAction } from "./loop";
export { liveGeminiPort, getGeminiClient } from "./gemini";
export type { CrmLlmPort } from "./provider";
