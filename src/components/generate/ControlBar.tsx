import React from "react";
import { Save, RotateCcw, CopyCheck } from "lucide-react";
import { Button } from "../ui/button";
import { InlineErrorMessage } from "../ui/InlineErrorMessage";

interface ControlBarProps {
  acceptedCount: number;
  nonRejectedCount: number;
  isSaving: boolean;
  errorMessage?: string;
  onSaveAccepted: () => void;
  onSaveAll: () => void;
  onReset: () => void;
}

export const ControlBar: React.FC<ControlBarProps> = ({
  acceptedCount,
  nonRejectedCount,
  isSaving,
  errorMessage,
  onSaveAccepted,
  onSaveAll,
  onReset,
}) => {
  return (
    <div className="sticky bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t p-4 z-10">
      <div className="container max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-end gap-4">
        <div className="flex flex-wrap items-center justify-end gap-3 w-full sm:w-auto">
          <InlineErrorMessage message={errorMessage} />

          <Button variant="outline" onClick={onReset} disabled={isSaving} className="gap-2">
            <RotateCcw className="w-4 h-4" />
            Reset
          </Button>

          <Button
            variant="secondary"
            onClick={onSaveAll}
            disabled={isSaving || nonRejectedCount === 0}
            className="gap-2"
          >
            <CopyCheck className="w-4 h-4" />
            Save All ({nonRejectedCount})
          </Button>

          <Button onClick={onSaveAccepted} disabled={isSaving || acceptedCount === 0} className="gap-2">
            {isSaving ? (
              <>Saving...</>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Accepted ({acceptedCount})
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
