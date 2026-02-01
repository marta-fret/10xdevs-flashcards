import React from "react";
import { Button } from "../ui/button";
import { Card, CardContent, CardFooter } from "../ui/card";
import { Pencil, Trash2 } from "lucide-react";
import type { FlashcardListItemViewModel } from "./types";

interface UserFlashcardListItemProps {
  item: FlashcardListItemViewModel;
  onEditClick: (id: number) => void;
  onDeleteClick: (id: number) => void;
}

export const UserFlashcardListItem: React.FC<UserFlashcardListItemProps> = ({ item, onEditClick, onDeleteClick }) => {
  return (
    <Card className="flex flex-col h-full hover:shadow-md transition-shadow duration-200">
      <CardContent className="flex-1 p-4 space-y-4">
        <div className="flex justify-between items-start gap-2">
          <div className="space-y-1 w-full">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Front</span>
            </div>
            <p className="text-sm font-medium leading-relaxed min-h-[3rem] whitespace-pre-wrap line-clamp-4">
              {item.front}
            </p>
          </div>
        </div>

        <div className="border-t border-border/50 pt-3 space-y-1">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Back</span>
          <p className="text-sm text-muted-foreground leading-relaxed min-h-[3rem] whitespace-pre-wrap line-clamp-4">
            {item.back}
          </p>
        </div>
      </CardContent>

      <CardFooter className="p-3 pt-0 flex justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => onEditClick(item.id)}
          disabled={item.isUpdating || item.isDeleting}
        >
          <Pencil className="w-4 h-4" />
          <span className="sr-only">Edit</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
          onClick={() => onDeleteClick(item.id)}
          disabled={item.isUpdating || item.isDeleting}
        >
          <Trash2 className="w-4 h-4" />
          <span className="sr-only">Delete</span>
        </Button>
      </CardFooter>
    </Card>
  );
};
