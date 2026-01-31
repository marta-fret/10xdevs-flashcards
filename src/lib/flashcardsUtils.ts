import { z } from "zod";

export const createFlashcardCommandItemSchema = z.object({
  front: z.string().trim().min(1).max(200),
  back: z.string().trim().min(1).max(500),
  source: z.enum(["ai-full", "ai-edited", "manual"]),
  // Ensure generation_id is either a number or explicitly null, never undefined.
  generation_id: z.union([z.number(), z.null()]),
});

export const createFlashcardsCommandSchema = z
  .object({
    flashcards: z.array(createFlashcardCommandItemSchema).min(1),
  })
  .refine(
    (data) => {
      for (const fc of data.flashcards) {
        if ((fc.source === "ai-full" || fc.source === "ai-edited") && fc.generation_id === null) {
          return false;
        }
        if (fc.source === "manual" && fc.generation_id !== null) {
          return false;
        }
      }
      return true;
    },
    {
      message: "generation_id is required for AI-generated flashcards and must be null for manual ones.",
    }
  );

const parseNumberQuery = (defaultValue: number, min: number, max?: number) =>
  z.preprocess(
    (value) => {
      if (value === undefined || value === null || value === "") {
        return undefined;
      }
      if (typeof value === "string") {
        const parsed = Number(value);
        if (Number.isNaN(parsed)) {
          return NaN;
        }
        return parsed;
      }
      return value;
    },
    max !== undefined
      ? z.number().int().min(min).max(max).default(defaultValue)
      : z.number().int().min(min).default(defaultValue)
  );

export const flashcardsListQuerySchema = z.object({
  page: parseNumberQuery(1, 1),
  limit: parseNumberQuery(10, 1, 100),
  q: z.string().optional(),
  sort: z.enum(["created_at", "updated_at"]).default("created_at"),
  order: z.enum(["asc", "desc"]).default("desc"),
  source: z.enum(["ai-full", "ai-edited", "manual"]).optional(),
});
