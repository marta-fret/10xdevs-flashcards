import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { InlineErrorMessage } from "../ui/InlineErrorMessage";
import type { FlashcardProposalUi, EditProposalFormValues } from "./types";
import type { FlashcardDetailResponseDto } from "../../types";

const proposalSchema = z.object({
  front: z.string().max(200, "Front must be 200 characters or less").min(1, "Front cannot be empty"),
  back: z.string().max(500, "Back must be 500 characters or less").min(1, "Back cannot be empty"),
});

export interface FlashcardEditModalProps {
  proposal: FlashcardProposalUi | FlashcardDetailResponseDto;
  isOpen: boolean;
  onConfirm: (id: string, values: EditProposalFormValues) => void;
  onClose: () => void;
}

export const FlashcardEditModal: React.FC<FlashcardEditModalProps> = ({ proposal, isOpen, onConfirm, onClose }) => {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isValid },
  } = useForm<EditProposalFormValues>({
    resolver: zodResolver(proposalSchema),
    mode: "onChange",
    defaultValues: {
      front: "",
      back: "",
    },
  });

  useEffect(() => {
    if (isOpen) {
      reset({
        front: proposal.front,
        back: proposal.back,
      });
    }
  }, [proposal, isOpen, reset]);

  const onSubmit = (data: EditProposalFormValues) => {
    // Handle both temp_id (proposal) and id (existing flashcard)
    const id = "temp_id" in proposal ? proposal.temp_id : proposal.id.toString();
    onConfirm(id, data);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Flashcard</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="front">Front</Label>
            <Textarea id="front" {...register("front")} className="resize-none" placeholder="Front of the card" />
            <InlineErrorMessage message={errors.front?.message} />
            <div className="text-xs text-right text-muted-foreground">Max 200 characters</div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="back">Back</Label>
            <Textarea
              id="back"
              {...register("back")}
              className="resize-none min-h-[100px]"
              placeholder="Back of the card"
            />
            <InlineErrorMessage message={errors.back?.message} />
            <div className="text-xs text-right text-muted-foreground">Max 500 characters</div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!isValid}>
              Confirm
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
