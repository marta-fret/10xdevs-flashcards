import React from "react";
import { AlertCircle } from "lucide-react";

interface InlineErrorMessageProps {
  message?: string;
  className?: string;
}

export const InlineErrorMessage: React.FC<InlineErrorMessageProps> = ({ message, className = "" }) => {
  if (!message) return null;

  return (
    <div className={`flex items-center gap-2 text-sm text-destructive ${className}`}>
      <AlertCircle className="h-4 w-4" />
      <span>{message}</span>
    </div>
  );
};
