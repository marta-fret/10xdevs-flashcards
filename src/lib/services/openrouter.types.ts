import { z } from "zod";

export type OpenRouterMessageRole = "system" | "user" | "assistant";

export interface OpenRouterChatMessage {
  role: OpenRouterMessageRole;
  content: string;
}

export interface OpenRouterResponseFormat {
  type: "json_schema";
  json_schema: {
    name: string;
    schema: Record<string, unknown>;
  };
}

export interface OpenRouterModelParams {
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
}

export interface OpenRouterChatOptions {
  userMessage: string;
  abortController?: AbortController;
}

export interface OpenRouterChatResult {
  rawText: string;
  rawResponse: unknown;
  parsedJson?: unknown;
}

export interface OpenRouterRequestBody extends OpenRouterModelParams {
  model: string;
  messages: OpenRouterChatMessage[];
  response_format?: OpenRouterResponseFormat;
}

export type OpenRouterErrorCode =
  | "CONFIG_ERROR"
  | "VALIDATION_ERROR"
  | "AUTH_ERROR"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "NETWORK_ERROR"
  | "BAD_RESPONSE"
  | "UPSTREAM_ERROR"
  | "UNKNOWN";

export interface OpenRouterServiceConfig {
  apiKey: string;
  apiUrl?: string;
  model: string;
  modelParams: OpenRouterModelParams;
  timeoutMs?: number;
}

export interface Logger {
  debug(message: string, meta?: unknown): void;
  info(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
  error(message: string, meta?: unknown): void;
}

export class OpenRouterServiceError extends Error {
  public readonly code: OpenRouterErrorCode;
  public readonly status?: number;
  public readonly details?: unknown;

  constructor(code: OpenRouterErrorCode, message: string, status?: number, details?: unknown) {
    super(message);
    this.name = "OpenRouterServiceError";
    this.code = code;
    this.status = status;
    this.details = details;

    // Restore prototype chain for instanceof checks
    Object.setPrototypeOf(this, OpenRouterServiceError.prototype);
  }
}

// Zod schemas for validation
export const OpenRouterModelParamsSchema = z.object({
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().positive().optional(),
  top_p: z.number().min(0).max(1).optional(),
  presence_penalty: z.number().min(-2).max(2).optional(),
  frequency_penalty: z.number().min(-2).max(2).optional(),
});

export const OpenRouterServiceConfigSchema = z.object({
  apiKey: z.string().min(1, "API key is required"),
  apiUrl: z.string().url().optional(),
  model: z.string().min(1, "Model name is required"),
  modelParams: OpenRouterModelParamsSchema,
  timeoutMs: z.number().positive().optional(),
});
