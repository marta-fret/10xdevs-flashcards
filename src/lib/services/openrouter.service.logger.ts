import { type Logger } from "./openrouter.types";

/**
 * Simple logger implementation that wraps console and sanitizes sensitive data
 */
export class OpenRouterLogger implements Logger {
  private sensitiveKeys: Set<string>;

  constructor(additionalSensitiveKeys: string[] = []) {
    this.sensitiveKeys = new Set([
      "apikey",
      "password",
      "secret",
      "token",
      "authorization",
      ...additionalSensitiveKeys.map((k) => k.toLowerCase()),
    ]);
  }

  private sanitize(data: unknown): unknown {
    if (!data) return data;
    if (typeof data !== "object") return data;

    if (Array.isArray(data)) {
      return data.map((item) => this.sanitize(item));
    }

    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (this.sensitiveKeys.has(key.toLowerCase())) {
        sanitized[key] = "[REDACTED]";
      } else if (typeof value === "object" && value !== null) {
        sanitized[key] = this.sanitize(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  debug(message: string, meta?: unknown): void {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.debug(`[OpenRouter] ${message}`, this.sanitize(meta));
    }
  }

  info(message: string, meta?: unknown): void {
    // eslint-disable-next-line no-console
    console.info(`[OpenRouter] ${message}`, this.sanitize(meta));
  }

  warn(message: string, meta?: unknown): void {
    // eslint-disable-next-line no-console
    console.warn(`[OpenRouter] ${message}`, this.sanitize(meta));
  }

  error(message: string, meta?: unknown): void {
    // eslint-disable-next-line no-console
    console.error(`[OpenRouter] ${message}`, this.sanitize(meta));
  }
}
