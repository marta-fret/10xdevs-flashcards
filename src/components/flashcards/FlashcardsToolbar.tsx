import React from "react";
import { Button } from "../ui/button";
import { Plus } from "lucide-react";

interface FlashcardsToolbarProps {
  isDisabled: boolean;
  onCreateClick: () => void;
  // Future: onSearchChange?(value: string): void;
}

export const FlashcardsToolbar: React.FC<FlashcardsToolbarProps> = ({ isDisabled, onCreateClick }) => {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
      <h1 className="text-3xl font-bold tracking-tight">Your Flashcards</h1>
      <div className="flex items-center gap-2">
        {/* Future search input will go here */}
        <Button onClick={onCreateClick} disabled={isDisabled}>
          <Plus className="h-4 w-4 mr-2" />
          Create flashcard
        </Button>
      </div>
    </div>
  );
};
