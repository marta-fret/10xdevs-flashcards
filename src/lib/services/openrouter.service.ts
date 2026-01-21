import {
  type Logger,
  type OpenRouterChatOptions,
  type OpenRouterChatResult,
  type OpenRouterModelParams,
  type OpenRouterResponseFormat,
  type OpenRouterServiceConfig,
  OpenRouterServiceConfigSchema,
  OpenRouterServiceError,
  type OpenRouterChatMessage,
  OpenRouterModelParamsSchema,
  type OpenRouterRequestBody,
} from "./openrouter.types";

/**
 * Simple logger implementation that wraps console
 */
class OpenRouterLogger implements Logger {
  debug(message: string, meta?: unknown): void {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.debug(`[OpenRouter] ${message}`, meta);
    }
  }

  info(message: string, meta?: unknown): void {
    // eslint-disable-next-line no-console
    console.info(`[OpenRouter] ${message}`, meta);
  }

  warn(message: string, meta?: unknown): void {
    // eslint-disable-next-line no-console
    console.warn(`[OpenRouter] ${message}`, meta);
  }

  error(message: string, meta?: unknown): void {
    // eslint-disable-next-line no-console
    console.error(`[OpenRouter] ${message}`, meta);
  }
}

export class OpenRouterService {
  apiKey: string;
  apiUrl: string;
  timeoutMs: number;
  logger: Logger;
  systemMessage: string | null = null;
  responseFormat: OpenRouterResponseFormat | null = null;
  _model: string;
  _modelParams: OpenRouterModelParams;

  constructor(config: OpenRouterServiceConfig) {
    const result = OpenRouterServiceConfigSchema.safeParse(config);
    if (!result.success) {
      throw new OpenRouterServiceError(
        "CONFIG_ERROR",
        "Invalid OpenRouter configuration",
        undefined,
        result.error.flatten()
      );
    }

    const validConfig = result.data;
    this.apiKey = validConfig.apiKey;
    this.apiUrl = validConfig.apiUrl || "https://openrouter.ai/api";
    this._model = validConfig.model;
    this._modelParams = validConfig.modelParams;
    this.timeoutMs = validConfig.timeoutMs || 30_000;
    this.logger = new OpenRouterLogger();
  }

  public get model(): string {
    return this._model;
  }

  public get modelParams(): OpenRouterModelParams {
    return { ...this._modelParams };
  }

  /**
   * Main entry point for single-response, non-streaming chat.
   */
  public async chat(options: OpenRouterChatOptions): Promise<OpenRouterChatResult> {
    if (!options.userMessage || options.userMessage.trim() === "") {
      throw new OpenRouterServiceError("VALIDATION_ERROR", "User message cannot be empty");
    }

    const messages = this.buildMessages(options.userMessage);
    const body = this.buildRequestBody(messages);

    try {
      const response = await this.callApi(body, options.abortController);
      const result = this.parseChatResponse(response);
      return this.parseJsonIfNeeded(result, this.responseFormat);
    } catch (error) {
      if (error instanceof OpenRouterServiceError) {
        throw error;
      }
      throw new OpenRouterServiceError(
        "UNKNOWN",
        error instanceof Error ? error.message : "Unknown error occurred",
        undefined,
        error
      );
    }
  }

  public setSystemMessage(systemMessage: string | null): void {
    this.systemMessage = systemMessage;
  }

  public setResponseFormat(responseFormat: OpenRouterResponseFormat | null): void {
    if (responseFormat) {
      if (!responseFormat.json_schema?.name || !responseFormat.json_schema?.schema) {
        throw new OpenRouterServiceError("VALIDATION_ERROR", "Invalid response format: missing name or schema");
      }
    }
    this.responseFormat = responseFormat;
  }

  public configureModel(config: { model?: string; params?: OpenRouterModelParams }): void {
    if (config.model !== undefined) {
      if (typeof config.model !== "string" || config.model.trim() === "") {
        throw new OpenRouterServiceError("VALIDATION_ERROR", "Model name must be a non-empty string");
      }
      this._model = config.model;
    }

    if (config.params) {
      const result = OpenRouterModelParamsSchema.safeParse(config.params);
      if (!result.success) {
        throw new OpenRouterServiceError(
          "VALIDATION_ERROR",
          "Invalid model parameters",
          undefined,
          result.error.flatten()
        );
      }
      this._modelParams = result.data;
    }
  }

  private buildMessages(userMessage: string): OpenRouterChatMessage[] {
    const messages: OpenRouterChatMessage[] = [];
    if (this.systemMessage) {
      messages.push({ role: "system", content: this.systemMessage });
    }
    messages.push({ role: "user", content: userMessage });
    return messages;
  }

  private buildRequestBody(messages: OpenRouterChatMessage[]): OpenRouterRequestBody {
    const body: OpenRouterRequestBody = {
      model: this._model,
      messages,
      ...this._modelParams,
    };

    if (this.responseFormat) {
      body.response_format = this.responseFormat;
    }

    // Remove undefined values without mutation
    return Object.fromEntries(
      Object.entries(body).filter(([, value]) => value !== undefined)
    ) as unknown as OpenRouterRequestBody;
  }

  private async callApi(body: unknown, abortController?: AbortController): Promise<unknown> {
    const controller = abortController || new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    const signal = controller.signal;

    try {
      const response = await fetch(`${this.apiUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://10xdevs-flashcards.com", // Optional but good for OpenRouter
          "X-Title": "10xDevs Flashcards", // Optional
        },
        body: JSON.stringify(body),
        signal,
      });

      if (!response.ok) {
        let errorBody: unknown;
        try {
          errorBody = await response.json();
        } catch {
          errorBody = await response.text();
        }

        if (response.status === 401 || response.status === 403) {
          throw new OpenRouterServiceError("AUTH_ERROR", "Authentication failed", response.status, errorBody);
        }
        if (response.status === 429) {
          throw new OpenRouterServiceError("RATE_LIMITED", "Rate limit exceeded", response.status, errorBody);
        }
        throw new OpenRouterServiceError("UPSTREAM_ERROR", "OpenRouter API error", response.status, errorBody);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof OpenRouterServiceError) throw error;

      if (error instanceof DOMException && error.name === "AbortError") {
        throw new OpenRouterServiceError("TIMEOUT", "Request timed out", undefined, error);
      }

      throw new OpenRouterServiceError("NETWORK_ERROR", "Network request failed", undefined, error);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private parseChatResponse(raw: unknown): OpenRouterChatResult {
    // Basic structural validation
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = raw as any;

    if (
      !response ||
      !response.choices ||
      !Array.isArray(response.choices) ||
      response.choices.length === 0 ||
      !response.choices[0].message
    ) {
      this.logger.error("Invalid response structure from OpenRouter", { raw });
      throw new OpenRouterServiceError("BAD_RESPONSE", "Invalid response structure from OpenRouter", undefined, raw);
    }

    const content = response.choices[0].message.content;
    if (typeof content !== "string") {
      this.logger.error("Missing content in OpenRouter response", { raw });
      throw new OpenRouterServiceError("BAD_RESPONSE", "Missing content in response", undefined, raw);
    }

    return {
      rawText: content,
      rawResponse: raw,
    };
  }

  private parseJsonIfNeeded(
    result: OpenRouterChatResult,
    responseFormat?: OpenRouterResponseFormat | null
  ): OpenRouterChatResult {
    if (!responseFormat || responseFormat.type !== "json_schema") {
      return result;
    }

    try {
      const parsed = JSON.parse(result.rawText);
      // Optional: Validate against schema using Ajv or Zod if we had the schema object compiled.
      // For now, we just trust the JSON parse as per plan instructions (step 6.1.10 says optional, 6.2.10 says if using Zod transform).
      // The plan 6.2.8 says "Attach parse error details".
      return {
        ...result,
        parsedJson: parsed,
      };
    } catch (error) {
      this.logger.error("Failed to parse JSON response", {
        text: result.rawText,
        error,
      });
      // The plan says "Attach parse error details; caller can decide whether to fall back to raw text."
      // But 6.2.10 says throw VALIDATION_ERROR.
      // Let's follow 6.2.8/9: JSON parse errors -> BAD_RESPONSE.
      throw new OpenRouterServiceError("BAD_RESPONSE", "Failed to parse JSON response", undefined, error);
    }
  }
}
