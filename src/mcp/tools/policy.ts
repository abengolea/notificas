export const FORBIDDEN_MCP_TOOLS = [
  "send_campaign",
  "send_bulk",
  "send_to_all",
  "start_campaign",
  "launch_campaign",
] as const;

export const IMPLEMENTED_MCP_TOOLS = [
  "get_account",
  "get_balance",
  "estimate_notification",
  "prepare_whatsapp",
  "send_whatsapp",
  "prepare_email",
  "send_email",
  "get_notification",
  "get_delivery_status",
  "get_certificate",
  "verify_notification",
  "create_campaign_draft",
  "get_campaign_status",
] as const;

export function isForbiddenMcpTool(name: string): boolean {
  return (FORBIDDEN_MCP_TOOLS as readonly string[]).includes(name);
}

