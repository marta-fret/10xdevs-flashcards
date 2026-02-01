import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { InlineErrorMessage } from "../ui/InlineErrorMessage";

const flashcardSchema = z.object({
  front: z.string().max(200, "Front must be 200 characters or less").min(1, "Front cannot be empty"),
  back: z.string().max(500, "Back must be 500 characters or less").min(1, "Back cannot be empty"),
});

export interface FlashcardFormValues {
  front: string;
  back: string;
}

export type FlashcardFormMode = "create" | "edit";

export interface FlashcardEditModalProps {
  mode: FlashcardFormMode;
  initialValues: FlashcardFormValues;
  id?: string; // optional for create, required for edit
  isOpen: boolean;
  isSubmitting?: boolean;
  onSubmit: (id: string | undefined, values: FlashcardFormValues) => void;
  onClose: () => void;
}

export const FlashcardEditModal: React.FC<FlashcardEditModalProps> = ({
  mode,
  initialValues,
  id,
  isOpen,
  isSubmitting = false,
  onSubmit,
  onClose,
}) => {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isValid },
  } = useForm<FlashcardFormValues>({
    resolver: zodResolver(flashcardSchema),
    mode: "onChange",
    defaultValues: {
      front: "",
      back: "",
    },
  });

  useEffect(() => {
    if (isOpen) {
      reset(initialValues);
    }
  }, [initialValues, isOpen, reset]);

  const handleFormSubmit = (data: FlashcardFormValues) => {
    onSubmit(id, data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Create Flashcard" : "Edit Flashcard"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="front">Front</Label>
            <Textarea
              id="front"
              {...register("front")}
              className="resize-none"
              placeholder="Front of the card"
              disabled={isSubmitting}
            />
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
              disabled={isSubmitting}
            />
            <InlineErrorMessage message={errors.back?.message} />
            <div className="text-xs text-right text-muted-foreground">Max 500 characters</div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={!isValid || isSubmitting}>
              {isSubmitting ? "Saving..." : "Confirm"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
