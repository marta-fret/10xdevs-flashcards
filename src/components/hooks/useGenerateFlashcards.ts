import { useState } from "react";
import type {
  ApiErrorResponse,
  CreateGenerationCommand,
  CreateGenerationResponseDto,
  GenerationsApiErrorCode,
} from "../../types";

interface UseGenerateFlashcardsResult {
  generate: (sourceText: string) => Promise<CreateGenerationResponseDto | null>;
  isLoading: boolean;
  error: string | null;
}

export const useGenerateFlashcards = (): UseGenerateFlashcardsResult => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async (sourceText: string): Promise<CreateGenerationResponseDto | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const payload: CreateGenerationCommand = { source_text: sourceText };

      const response = await fetch("/api/generations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorResponse = (await response.json().catch(() => ({
          error: { code: "internal_error", message: "Broken response data" },
        }))) as ApiErrorResponse<GenerationsApiErrorCode>;

        throw new Error(errorResponse.error.message || `Generation failed: ${response.statusText}`);
      }

      const data: CreateGenerationResponseDto = await response.json();
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred during generation";
      setError(errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return { generate, isLoading, error };
};
