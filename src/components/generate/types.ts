import type { FlashcardProposalDto } from "../../types";

export type SourceAi = "ai-full" | "ai-edited";

export interface FlashcardProposalUi extends Omit<FlashcardProposalDto, "source"> {
  accepted: boolean;
  rejected: boolean;
  source: SourceAi;
}

export interface EditProposalFormValues {
  front: string; // ≤200
  back: string; // ≤500
}
