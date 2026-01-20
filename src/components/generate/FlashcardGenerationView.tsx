import React, { useState, useMemo, useCallback } from "react";
import { SourceInputSection } from "./SourceInputSection";
import { FlashcardList } from "./FlashcardList";
import { ControlBar } from "./ControlBar";
import { LoadingOverlay } from "../ui/LoadingOverlay";
import { useGenerateFlashcards, useCreateFlashcards } from "../hooks";
import type { FlashcardProposalUi, EditProposalFormValues } from "./types";
import type { CreateFlashcardCommandItem } from "../../types";

type ProcessStatus = "initial" | "generating" | "generated" | "saving";

export const FlashcardGenerationView: React.FC = () => {
  const [proposals, setProposals] = useState<FlashcardProposalUi[]>([]);
  const [status, setStatus] = useState<ProcessStatus>("initial");
  const [generationId, setGenerationId] = useState<number | null>(null);

  const { generate, isLoading: isGenerating, error: generateError } = useGenerateFlashcards();
  const { create, isLoading: isSaving, error: createError } = useCreateFlashcards();

  const acceptedCount = useMemo(() => proposals.filter((p) => p.accepted && !p.rejected).length, [proposals]);

  const nonRejectedCount = useMemo(() => proposals.filter((p) => !p.rejected).length, [proposals]);

  const handleGenerate = async (sourceText: string) => {
    setStatus("generating");
    const result = await generate(sourceText);

    if (result) {
      setGenerationId(result.generation_id);
      const initialProposals: FlashcardProposalUi[] = result.flashcards_proposals.map((p) => ({
        ...p,
        accepted: false,
        rejected: false,
        source: "ai-full",
      }));
      setProposals(initialProposals);
      setStatus("generated");
    } else {
      setStatus("initial");
    }
  };

  const handleAccept = useCallback((id: string) => {
    setProposals((prev) => prev.map((p) => (p.temp_id === id ? { ...p, accepted: !p.accepted } : p)));
  }, []);

  const handleReject = useCallback((id: string) => {
    setProposals((prev) => prev.map((p) => (p.temp_id === id ? { ...p, rejected: true, accepted: false } : p)));
  }, []);

  const handleConfirmEdit = useCallback((id: string, values: EditProposalFormValues) => {
    setProposals((prev) =>
      prev.map((p) =>
        p.temp_id === id ? { ...p, front: values.front, back: values.back, source: "ai-edited", accepted: true } : p
      )
    );
  }, []);

  const handleReset = useCallback(() => {
    if (window.confirm("Are you sure you want to reset? All generated flashcards will be lost.")) {
      setProposals([]);
      setStatus("initial");
      setGenerationId(null);
    }
  }, []);

  const handleSave = async (onlyAccepted: boolean) => {
    if (generationId === null) return;

    setStatus("saving");

    const flashcardsToSave: CreateFlashcardCommandItem[] = proposals
      .filter((p) => !p.rejected && (onlyAccepted ? p.accepted : true))
      .map((p) => ({
        front: p.front,
        back: p.back,
        source: p.source,
        generation_id: generationId,
      }));

    const result = await create({ flashcards: flashcardsToSave });

    if (result) {
      // Redirect to flashcards list
      window.location.href = "/flashcards";
    } else {
      setStatus("generated");
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {(isGenerating || isSaving) && <LoadingOverlay />}

      <main className="flex-1 container max-w-7xl mx-auto py-8 px-4 space-y-8 pb-24">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Generate Flashcards</h1>
          <p className="text-muted-foreground">Paste your notes below and let AI create flashcards for you.</p>
        </div>

        <SourceInputSection
          onGenerate={handleGenerate}
          isLoading={isGenerating}
          disabled={status !== "initial"}
          errorMessage={generateError || undefined}
        />

        {status !== "initial" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Generated Flashcards</h2>
              <div className="text-sm text-muted-foreground">
                {acceptedCount} selected / {nonRejectedCount} available
              </div>
            </div>

            <FlashcardList
              proposals={proposals}
              onAccept={handleAccept}
              onReject={handleReject}
              onEdit={handleConfirmEdit}
            />
          </div>
        )}
      </main>

      {status !== "initial" && (
        <ControlBar
          acceptedCount={acceptedCount}
          nonRejectedCount={nonRejectedCount}
          isSaving={isSaving}
          errorMessage={createError || undefined}
          onSaveAccepted={() => handleSave(true)}
          onSaveAll={() => handleSave(false)}
          onReset={handleReset}
        />
      )}
    </div>
  );
};
