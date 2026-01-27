import { useState } from "react";
import type {
  ApiErrorResponse,
  CreateFlashcardsCommand,
  CreateFlashcardsResponseDto,
  FlashcardsApiErrorCode,
} from "../../types";

interface UseCreateFlashcardsResult {
  create: (payload: CreateFlashcardsCommand) => Promise<CreateFlashcardsResponseDto | null>;
  isLoading: boolean;
  error: string | null;
}

export const useCreateFlashcards = (): UseCreateFlashcardsResult => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async (payload: CreateFlashcardsCommand): Promise<CreateFlashcardsResponseDto | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/flashcards", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorResponse = (await response.json().catch(() => ({
          error: { code: "internal_error", message: "Broken response data" },
        }))) as ApiErrorResponse<FlashcardsApiErrorCode>;

        throw new Error(errorResponse?.error?.message || `Saving failed: ${response.statusText}`);
      }

      const data: CreateFlashcardsResponseDto = await response.json();
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred while saving flashcards";
      setError(errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return { create, isLoading, error };
};
