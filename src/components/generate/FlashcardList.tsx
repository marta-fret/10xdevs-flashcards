import React from "react";
import { FlashcardListItem } from "./FlashcardListItem";
import type { FlashcardProposalUi, EditProposalFormValues } from "./types";

interface FlashcardListProps {
  proposals: FlashcardProposalUi[];
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onEdit: (id: string, values: EditProposalFormValues) => void;
}

export const FlashcardList: React.FC<FlashcardListProps> = ({ proposals, onAccept, onReject, onEdit }) => {
  // Filter out rejected proposals
  const visibleProposals = proposals.filter((p) => !p.rejected);

  if (visibleProposals.length === 0) {
    return (
      <div className="text-center p-8 text-muted-foreground border rounded-lg border-dashed">
        No flashcards generated yet or all have been rejected.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {visibleProposals.map((proposal) => (
        <FlashcardListItem
          key={proposal.temp_id}
          proposal={proposal}
          onAccept={onAccept}
          onReject={onReject}
          onEdit={onEdit}
        />
      ))}
    </div>
  );
};
