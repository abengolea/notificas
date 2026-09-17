import {
  MarketingConflictError,
  MarketingError,
  MarketingNotFoundError,
  MarketingValidationError,
  MarketingWorkspaceMismatchError,
} from "../errors";

export function crmErrorCode(err: unknown): { code: string; message: string } {
  if (err instanceof MarketingNotFoundError || err instanceof MarketingWorkspaceMismatchError) {
    return { code: "entity_not_found", message: err.message };
  }
  if (err instanceof MarketingValidationError) {
    return { code: "validation_error", message: err.message };
  }
  if (err instanceof MarketingConflictError) {
    return { code: "conflict", message: err.message };
  }
  if (err instanceof MarketingError) {
    return { code: err.code, message: err.message };
  }
  if (err instanceof Error) {
    return { code: "internal_error", message: "No se pudo completar la operación CRM." };
  }
  return { code: "internal_error", message: "No se pudo completar la operación CRM." };
}
