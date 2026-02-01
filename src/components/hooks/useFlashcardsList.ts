import { useState, useCallback } from "react";
import type {
  ApiErrorResponse,
  FlashcardsApiErrorCode,
  FlashcardsListResponseDto,
  FlashcardsListQueryCommand,
} from "../../types";

interface UseFlashcardsListResult {
  fetchList: (query: FlashcardsListQueryCommand) => Promise<FlashcardsListResponseDto | null>;
  isLoading: boolean;
  error: string | null;
}

export const useFlashcardsList = (): UseFlashcardsListResult => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchList = useCallback(
    async (query: FlashcardsListQueryCommand): Promise<FlashcardsListResponseDto | null> => {
      setIsLoading(true);
      setError(null);

      try {
        // Build query string
        const params = new URLSearchParams();
        if (query.page) params.append("page", query.page.toString());
        if (query.limit) params.append("limit", query.limit.toString());
        if (query.sort) params.append("sort", query.sort);
        if (query.order) params.append("order", query.order);
        if (query.q) params.append("q", query.q);
        if (query.source) params.append("source", query.source);

        const response = await fetch(`/api/flashcards?${params.toString()}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          const errorResponse = (await response.json().catch(() => ({
            error: { code: "internal_error", message: "Broken response data" },
          }))) as ApiErrorResponse<FlashcardsApiErrorCode>;

          throw new Error(errorResponse?.error?.message || `Loading failed: ${response.statusText}`);
        }

        const data: FlashcardsListResponseDto = await response.json();
        return data;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "An unexpected error occurred while loading flashcards";
        setError(errorMessage);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return { fetchList, isLoading, error };
};
