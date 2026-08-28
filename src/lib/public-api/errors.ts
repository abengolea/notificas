export type PublicApiErrorType =
  | "authentication_error"
  | "authorization_error"
  | "validation_error"
  | "not_found"
  | "conflict"
  | "rate_limit_error"
  | "idempotency_error"
  | "api_error";

export type PublicApiErrorBody = {
  error: {
    type: PublicApiErrorType;
    code: string;
    message: string;
    request_id: string;
    param?: string;
  };
};

export class PublicApiError extends Error {
  readonly httpStatus: number;
  readonly type: PublicApiErrorType;
  readonly code: string;
  readonly param?: string;

  constructor(opts: {
    httpStatus: number;
    type: PublicApiErrorType;
    code: string;
    message: string;
    param?: string;
  }) {
    super(opts.message);
    this.name = "PublicApiError";
    this.httpStatus = opts.httpStatus;
    this.type = opts.type;
    this.code = opts.code;
    this.param = opts.param;
  }
}

export function errorBody(err: PublicApiError, requestId: string): PublicApiErrorBody {
  return {
    error: {
      type: err.type,
      code: err.code,
      message: err.message,
      request_id: requestId,
      ...(err.param ? { param: err.param } : {}),
    },
  };
}

export function invalidRequest(code: string, message: string, param?: string): PublicApiError {
  return new PublicApiError({
    httpStatus: 400,
    type: "validation_error",
    code,
    message,
    param,
  });
}

export function unauthorized(code = "invalid_api_key", message = "Invalid API key."): PublicApiError {
  return new PublicApiError({
    httpStatus: 401,
    type: "authentication_error",
    code,
    message,
  });
}

export function forbidden(code: string, message: string): PublicApiError {
  return new PublicApiError({
    httpStatus: 403,
    type: "authorization_error",
    code,
    message,
  });
}

export function notFound(code: string, message: string): PublicApiError {
  return new PublicApiError({
    httpStatus: 404,
    type: "not_found",
    code,
    message,
  });
}

export function conflict(code: string, message: string): PublicApiError {
  return new PublicApiError({
    httpStatus: 409,
    type: "conflict",
    code,
    message,
  });
}

export function unprocessable(code: string, message: string, param?: string): PublicApiError {
  return new PublicApiError({
    httpStatus: 422,
    type: "validation_error",
    code,
    message,
    param,
  });
}

export function rateLimited(retryAfterSeconds: number): PublicApiError {
  return new PublicApiError({
    httpStatus: 429,
    type: "rate_limit_error",
    code: "rate_limited",
    message: `Too many requests. Retry after ${retryAfterSeconds} seconds.`,
  });
}

export function internalError(): PublicApiError {
  return new PublicApiError({
    httpStatus: 500,
    type: "api_error",
    code: "internal_error",
    message: "An internal error occurred.",
  });
}

export function httpStatusForType(type: PublicApiErrorType): number {
  switch (type) {
    case "authentication_error":
      return 401;
    case "authorization_error":
      return 403;
    case "validation_error":
      return 400;
    case "not_found":
      return 404;
    case "conflict":
      return 409;
    case "rate_limit_error":
      return 429;
    default:
      return 500;
  }
}
