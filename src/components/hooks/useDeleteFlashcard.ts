import { useState } from "react";
import type { ApiErrorResponse, DeleteFlashcardResponseDto, FlashcardsApiDeleteErrorCode } from "../../types";

interface UseDeleteFlashcardResult {
  remove: (id: number) => Promise<DeleteFlashcardResponseDto | null>;
  isLoading: boolean;
  error: string | null;
}

export const useDeleteFlashcard = (): UseDeleteFlashcardResult => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async (id: number): Promise<DeleteFlashcardResponseDto | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/flashcards/${id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorResponse = (await response.json().catch(() => ({
          error: { code: "internal_error", message: "Broken response data" },
        }))) as ApiErrorResponse<FlashcardsApiDeleteErrorCode>;

        throw new Error(errorResponse?.error?.message || `Delete failed: ${response.statusText}`);
      }

      const data: DeleteFlashcardResponseDto = await response.json();
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred while deleting flashcard";
      setError(errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return { remove, isLoading, error };
};
