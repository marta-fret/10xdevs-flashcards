import { useState } from "react";
import type {
  ApiErrorResponse,
  FlashcardDetailResponseDto,
  FlashcardsApiPatchErrorCode,
  UpdateFlashcardCommand,
} from "../../types";

interface UseUpdateFlashcardResult {
  update: (id: number, payload: UpdateFlashcardCommand) => Promise<FlashcardDetailResponseDto | null>;
  isLoading: boolean;
  error: string | null;
}

export const useUpdateFlashcard = (): UseUpdateFlashcardResult => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = async (id: number, payload: UpdateFlashcardCommand): Promise<FlashcardDetailResponseDto | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/flashcards/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorResponse = (await response.json().catch(() => ({
          error: { code: "internal_error", message: "Broken response data" },
        }))) as ApiErrorResponse<FlashcardsApiPatchErrorCode>;

        throw new Error(errorResponse?.error?.message || `Update failed: ${response.statusText}`);
      }

      const data: FlashcardDetailResponseDto = await response.json();
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred while updating flashcard";
      setError(errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return { update, isLoading, error };
};
