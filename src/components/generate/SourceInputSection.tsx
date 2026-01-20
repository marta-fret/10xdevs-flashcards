import React, { useState, useEffect } from "react";
import { Textarea } from "../ui/textarea";
import { Button } from "../ui/button";
import { InlineErrorMessage } from "../ui/InlineErrorMessage";
import { cn } from "@/lib/utils";

interface SourceInputSectionProps {
  onGenerate: (sourceText: string) => void;
  isLoading?: boolean;
  errorMessage?: string;
  disabled?: boolean;
}

const MIN_LENGTH = 1000;
const MAX_LENGTH = 10000;

export const SourceInputSection: React.FC<SourceInputSectionProps> = ({
  onGenerate,
  isLoading = false,
  errorMessage,
  disabled = false,
}) => {
  const [sourceText, setSourceText] = useState("");
  const [isValid, setIsValid] = useState(false);

  useEffect(() => {
    const length = sourceText.length;
    setIsValid(length >= MIN_LENGTH && length <= MAX_LENGTH);
  }, [sourceText]);

  const handleGenerate = () => {
    if (isValid && !disabled && !isLoading) {
      onGenerate(sourceText);
    }
  };

  const textLength = sourceText.length;

  return (
    <div className="space-y-4 w-full">
      <div className="grid w-full gap-1.5">
        <p className="text-sm text-muted-foreground">
          Enter between {MIN_LENGTH} and {MAX_LENGTH} characters.
        </p>
        <Textarea
          id="source-text"
          placeholder="Paste your study notes here..."
          value={sourceText}
          onChange={(e) => setSourceText(e.target.value)}
          className="min-h-[200px] text-base"
          disabled={disabled || isLoading}
        />
        <div className="flex justify-between items-center">
          <span
            className={cn(
              "text-sm font-medium transition-colors",
              isValid ? "text-green-600 dark:text-green-400" : "text-muted-foreground",
              (textLength > 0 && textLength < MIN_LENGTH) || textLength > MAX_LENGTH ? "text-destructive" : ""
            )}
          >
            {textLength} / {MAX_LENGTH} characters
          </span>
          <div className="flex items-center gap-4">
            <InlineErrorMessage message={errorMessage} />
            <Button onClick={handleGenerate} disabled={!isValid || disabled || isLoading}>
              {isLoading ? "Generating..." : "Generate Flashcards"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
