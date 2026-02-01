import React from "react";
import { UserFlashcardListItem } from "./UserFlashcardListItem";
import type { FlashcardListItemViewModel } from "./types";
import { Button } from "../ui/button";

interface UserFlashcardsListProps {
  items: FlashcardListItemViewModel[];
  onEditClick: (id: number) => void;
  onDeleteClick: (id: number) => void;
  onCreateClick?: () => void; // Optional, for empty state action
}

export const UserFlashcardsList: React.FC<UserFlashcardsListProps> = ({
  items,
  onEditClick,
  onDeleteClick,
  onCreateClick,
}) => {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed rounded-lg border-muted">
        <h3 className="text-lg font-semibold mb-2">You don&apos;t have any flashcards yet</h3>
        <p className="text-muted-foreground mb-6 max-w-sm">
          Create your first flashcard manually or generate one using AI to get started.
        </p>
        {onCreateClick && <Button onClick={onCreateClick}>Create your first flashcard</Button>}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {items.map((item) => (
        <UserFlashcardListItem key={item.id} item={item} onEditClick={onEditClick} onDeleteClick={onDeleteClick} />
      ))}
    </div>
  );
};
