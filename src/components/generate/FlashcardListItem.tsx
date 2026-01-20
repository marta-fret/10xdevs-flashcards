import React, { useState } from "react";
import { Check, X, Pencil } from "lucide-react";
import { Button } from "../ui/button";
import { Card, CardContent, CardFooter } from "../ui/card";
import { Badge } from "../ui/badge";
import { cn } from "@/lib/utils";
import { FlashcardEditModal } from "./FlashcardEditModal";
import type { FlashcardProposalUi, EditProposalFormValues } from "./types";

interface FlashcardListItemProps {
  proposal: FlashcardProposalUi;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onEdit: (id: string, values: EditProposalFormValues) => void;
}

export const FlashcardListItem: React.FC<FlashcardListItemProps> = ({ proposal, onAccept, onReject, onEdit }) => {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const isEdited = proposal.source === "ai-edited";

  return (
    <Card
      className={cn(
        "flex flex-col h-full transition-all duration-200",
        proposal.accepted ? "border-green-500 ring-1 ring-green-500 bg-green-50/10 dark:bg-green-900/10" : "",
        proposal.rejected ? "opacity-50 grayscale" : ""
      )}
    >
      <CardContent className="flex-1 p-4 space-y-4">
        <div className="flex justify-between items-start gap-2">
          <div className="space-y-1 w-full">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Front</span>
              {isEdited && (
                <Badge variant="secondary" className="text-[10px] h-5 gap-1 px-1.5">
                  <Pencil className="w-3 h-3" />
                  Edited
                </Badge>
              )}
            </div>
            <p className="text-sm font-medium leading-relaxed min-h-[3rem] whitespace-pre-wrap">{proposal.front}</p>
          </div>
        </div>

        <div className="border-t border-border/50 pt-3 space-y-1">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Back</span>
          <p className="text-sm text-muted-foreground leading-relaxed min-h-[3rem] whitespace-pre-wrap">
            {proposal.back}
          </p>
        </div>
      </CardContent>

      <CardFooter className="p-3 pt-0 flex justify-between gap-2">
        <div className="flex gap-2">
          <Button
            variant={proposal.accepted ? "default" : "outline"}
            size="sm"
            className={cn(
              "h-8 px-2 lg:px-3 gap-1.5",
              proposal.accepted && "bg-green-600 hover:bg-green-700 text-white"
            )}
            onClick={() => onAccept(proposal.temp_id)}
          >
            <Check className="w-4 h-4" />
            <span className="sr-only lg:not-sr-only">{proposal.accepted ? "Accepted" : "Accept"}</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 lg:px-3 gap-1.5"
            onClick={() => onReject(proposal.temp_id)}
          >
            <X className="w-4 h-4" />
            <span className="sr-only lg:not-sr-only">Reject</span>
          </Button>
        </div>

        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setIsEditModalOpen(true)}>
          <Pencil className="w-4 h-4" />
          <span className="sr-only">Edit</span>
        </Button>
      </CardFooter>
      <FlashcardEditModal
        proposal={proposal}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onConfirm={onEdit}
      />
    </Card>
  );
};
