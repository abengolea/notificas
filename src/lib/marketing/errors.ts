export type MarketingErrorCode = "validation" | "not_found" | "workspace" | "conflict";

export class MarketingError extends Error {
  readonly code: MarketingErrorCode;
  readonly details?: unknown;

  constructor(code: MarketingErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "MarketingError";
    this.code = code;
    this.details = details;
  }
}

export class MarketingValidationError extends MarketingError {
  constructor(message: string, details?: unknown) {
    super("validation", message, details);
    this.name = "MarketingValidationError";
  }
}

export class MarketingNotFoundError extends MarketingError {
  constructor(entity: string, id?: string) {
    super("not_found", id ? `${entity} no encontrado: ${id}` : `${entity} no encontrado`);
    this.name = "MarketingNotFoundError";
  }
}

export class MarketingWorkspaceMismatchError extends MarketingError {
  constructor(message = "El registro no pertenece a este workspace CRM.") {
    super("workspace", message);
    this.name = "MarketingWorkspaceMismatchError";
  }
}

export class MarketingConflictError extends MarketingError {
  constructor(message: string, details?: unknown) {
    super("conflict", message, details);
    this.name = "MarketingConflictError";
  }
}

export type MarketingDuplicateWarning = {
  matchType: "exact" | "probable" | "possible";
  companyId: string;
  reasons: string[];
};
