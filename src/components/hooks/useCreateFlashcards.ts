import { useState } from "react";
import type { CreateFlashcardsCommand, CreateFlashcardsResponseDto } from "../../types";

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
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Saving failed: ${response.statusText}`);
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
