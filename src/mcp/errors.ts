import { PublicApiError } from "@/lib/public-api/errors";

export const MCP_ERROR_CODES = [
  "MCP_DISABLED",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "INSUFFICIENT_SCOPE",
  "INSUFFICIENT_CREDITS",
  "INVALID_RECIPIENT",
  "INVALID_TEMPLATE",
  "MISSING_TEMPLATE_VARIABLE",
  "MISSING_CONTENT",
  "NOTIFICATION_NOT_FOUND",
  "CAMPAIGN_NOT_FOUND",
  "RATE_LIMITED",
  "DUPLICATE_REQUEST",
  "IDEMPOTENCY_IN_PROGRESS",
  "VALIDATION_ERROR",
  "PROVIDER_ERROR",
  "FEATURE_NOT_AVAILABLE",
  "INTERNAL_ERROR",
] as const;

export type McpErrorCode = (typeof MCP_ERROR_CODES)[number];

export class McpToolError extends Error {
  readonly code: McpErrorCode;
  readonly httpStatus: number;
  readonly param?: string;

  constructor(code: McpErrorCode, message: string, httpStatus = 400, param?: string) {
    super(message);
    this.name = "McpToolError";
    this.code = code;
    this.httpStatus = httpStatus;
    this.param = param;
  }
}

const PUBLIC_TO_MCP: Record<string, McpErrorCode> = {
  insufficient_credits: "INSUFFICIENT_CREDITS",
  invalid_phone: "INVALID_RECIPIENT",
  invalid_email: "INVALID_RECIPIENT",
  unknown_template: "INVALID_TEMPLATE",
  missing_template: "INVALID_TEMPLATE",
  missing_content: "MISSING_CONTENT",
  notification_not_found: "NOTIFICATION_NOT_FOUND",
  not_found: "NOTIFICATION_NOT_FOUND",
  batch_not_found: "CAMPAIGN_NOT_FOUND",
  rate_limited: "RATE_LIMITED",
  idempotency_key_reused: "DUPLICATE_REQUEST",
  idempotency_in_progress: "IDEMPOTENCY_IN_PROGRESS",
  insufficient_scope: "INSUFFICIENT_SCOPE",
  invalid_api_key: "UNAUTHORIZED",
  invalid_token: "UNAUTHORIZED",
  expired_token: "UNAUTHORIZED",
  revoked_token: "UNAUTHORIZED",
};

export function mcpErrorFromPublic(err: PublicApiError): McpToolError {
  const code = PUBLIC_TO_MCP[err.code] || (err.httpStatus === 401 ? "UNAUTHORIZED" : err.httpStatus === 403 ? "FORBIDDEN" : err.httpStatus === 404 ? "NOTIFICATION_NOT_FOUND" : err.httpStatus === 429 ? "RATE_LIMITED" : "VALIDATION_ERROR");
  return new McpToolError(code, err.message, err.httpStatus, err.param);
}

export function publicOrMcpError(err: unknown): McpToolError {
  if (err instanceof McpToolError) return err;
  if (err instanceof PublicApiError) return mcpErrorFromPublic(err);
  return new McpToolError("INTERNAL_ERROR", "An internal error occurred.", 500);
}

export function toolErrorPayload(err: McpToolError, requestId: string): Record<string, unknown> {
  return {
    error: {
      code: err.code,
      message: err.message,
      request_id: requestId,
      ...(err.param ? { param: err.param } : {}),
    },
  };
}
