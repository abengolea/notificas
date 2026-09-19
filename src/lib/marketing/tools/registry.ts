import { CRM_READ_TOOL_DEFINITIONS, CRM_TOOL_DEFINITIONS, CRM_WRITE_TOOL_DEFINITIONS } from "./definitions";
import { CRM_FORBIDDEN_TOOL_NAMES, CRM_READ_TOOL_NAMES, CRM_WRITE_TOOL_NAMES } from "./types";

export const crmReadTools = CRM_READ_TOOL_DEFINITIONS;
export const crmWriteTools = CRM_WRITE_TOOL_DEFINITIONS;
export const crmToolDefinitions = CRM_TOOL_DEFINITIONS;

export function mcpCrmToolDefinitions() {
  return [...crmReadTools, ...crmWriteTools];
}

export function internalAiToolDefinitions() {
  return crmToolDefinitions;
}

export function crmToolRegistrySnapshot() {
  return {
    read: [...CRM_READ_TOOL_NAMES],
    write: [...CRM_WRITE_TOOL_NAMES],
    forbidden: [...CRM_FORBIDDEN_TOOL_NAMES],
  };
}
