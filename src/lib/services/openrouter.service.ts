import {
  type OpenRouterChatOptions,
  type OpenRouterChatResult,
  type OpenRouterModelParams,
  type OpenRouterResponseFormat,
  type OpenRouterServiceConfig,
  OpenRouterServiceConfigSchema,
  type OpenRouterChatMessage,
  OpenRouterModelParamsSchema,
  type OpenRouterRequestBody,
} from "./openrouter.types";
import { OpenRouterLogger } from "./openrouter.service.logger";
import { OpenRouterServiceError } from "./openrouter.service.error";

export class OpenRouterService {
  apiKey: string;
  apiUrl: string;
  timeoutMs: number;
  logger: OpenRouterLogger;
  systemMessage: string | null = null;
  responseFormat: OpenRouterResponseFormat | null = null;
  _model: string;
  _modelParams: OpenRouterModelParams = {
    temperature: 0.7,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
  };

  constructor(config: OpenRouterServiceConfig) {
    this.logger = new OpenRouterLogger();

    const result = OpenRouterServiceConfigSchema.safeParse(config);
    if (!result.success) {
      this.logger.error("Invalid OpenRouter configuration", { config });

      throw new OpenRouterServiceError("CONFIG_ERROR", "Invalid OpenRouter configuration");
    }

    const validConfig = result.data;
    this.apiKey = validConfig.apiKey;
    this.apiUrl = validConfig.apiUrl || "https://openrouter.ai/api/v1";
    this._model = validConfig.model;
    this._modelParams = validConfig.modelParams || this._modelParams;
    this.timeoutMs = validConfig.timeoutMs || 30_000;
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
      this.logger.error("User message cannot be empty");
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
      this.logger.error("Unknown error in chat", { error });
      throw new OpenRouterServiceError("UNKNOWN", error instanceof Error ? error.message : "Unknown error occurred");
    }
  }

  public setSystemMessage(systemMessage: string | null): void {
    this.systemMessage = systemMessage;
  }

  public setResponseFormat(responseFormat: OpenRouterResponseFormat | null): void {
    if (responseFormat) {
      if (!responseFormat.json_schema?.name || !responseFormat.json_schema?.schema) {
        this.logger.error("Invalid response format", { responseFormat });
        throw new OpenRouterServiceError("VALIDATION_ERROR", "Invalid response format: missing name or schema");
      }
    }
    this.responseFormat = responseFormat;
  }

  public configureModel(config: { model?: string; params?: OpenRouterModelParams }): void {
    if (config.model !== undefined) {
      if (typeof config.model !== "string" || config.model.trim() === "") {
        this.logger.error("Model name must be a non-empty string", { model: config.model });
        throw new OpenRouterServiceError("VALIDATION_ERROR", "Model name must be a non-empty string");
      }
      this._model = config.model;
    }

    if (config.params) {
      const result = OpenRouterModelParamsSchema.safeParse(config.params);
      if (!result.success) {
        this.logger.error("Invalid model parameters", { params: config.params, error: result.error });
        throw new OpenRouterServiceError("VALIDATION_ERROR", "Invalid model parameters");
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

        const meta = { status: response.status, statusText: response.statusText, body: errorBody };

        if (response.status === 401 || response.status === 403) {
          this.logger.error("Authentication failed", meta);
          throw new OpenRouterServiceError("AUTH_ERROR", "Authentication failed", response.status);
        }
        if (response.status === 429) {
          this.logger.error("Rate limit exceeded", meta);
          throw new OpenRouterServiceError("RATE_LIMITED", "Rate limit exceeded", response.status);
        }

        this.logger.error("OpenRouter API error", meta);
        throw new OpenRouterServiceError("UPSTREAM_ERROR", "OpenRouter API error", response.status);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof OpenRouterServiceError) throw error;

      if (error instanceof DOMException && error.name === "AbortError") {
        this.logger.error("Request timed out", { error });
        throw new OpenRouterServiceError("TIMEOUT", "Request timed out");
      }

      this.logger.error("Network request failed", { error });
      throw new OpenRouterServiceError("NETWORK_ERROR", "Network request failed");
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
      throw new OpenRouterServiceError("BAD_RESPONSE", "Invalid response structure from OpenRouter");
    }

    const content = response.choices[0].message.content;
    if (typeof content !== "string") {
      this.logger.error("Missing content in OpenRouter response", { raw });
      throw new OpenRouterServiceError("BAD_RESPONSE", "Missing content in response");
    }

    return { rawText: content };
  }

  private parseJsonIfNeeded(
    result: OpenRouterChatResult,
    responseFormat?: OpenRouterResponseFormat | null
  ): OpenRouterChatResult {
    if (!responseFormat || responseFormat.type !== "json_schema") {
      return {
        ...result,
        parsedJson: undefined,
      };
    }

    try {
      const parsed = JSON.parse(result.rawText);
      return {
        ...result,
        parsedJson: parsed,
      };
    } catch (error) {
      this.logger.error("Failed to parse JSON response", {
        text: result.rawText,
        error,
      });

      throw new OpenRouterServiceError("BAD_RESPONSE", "Failed to parse JSON response");
    }
  }
}
