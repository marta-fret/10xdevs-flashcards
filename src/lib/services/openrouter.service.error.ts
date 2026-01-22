import type { OpenRouterErrorCode } from "./openrouter.types";

export class OpenRouterServiceError extends Error {
  public readonly code: OpenRouterErrorCode;
  public readonly status?: number;

  constructor(code: OpenRouterErrorCode, message: string, status?: number) {
    super(message);
    this.name = "OpenRouterServiceError";
    this.code = code;
    this.status = status;
  }
}
