import React from "react";
import { Button } from "../ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PaginationMetaDto } from "../../types";

interface PaginationControlsProps {
  pagination: PaginationMetaDto | null;
  isDisabled: boolean;
  onPageChange: (page: number) => void;
}

export const PaginationControls: React.FC<PaginationControlsProps> = ({ pagination, isDisabled, onPageChange }) => {
  if (!pagination || pagination.total_pages <= 1) {
    return null;
  }

  const { page, total_pages } = pagination;

  return (
    <div className="flex items-center justify-center space-x-4 py-4">
      <Button variant="outline" size="sm" onClick={() => onPageChange(page - 1)} disabled={isDisabled || page <= 1}>
        <ChevronLeft className="h-4 w-4 mr-2" />
        Previous
      </Button>
      <div className="text-sm text-muted-foreground">
        Page {page} of {total_pages}
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(page + 1)}
        disabled={isDisabled || page >= total_pages}
      >
        Next
        <ChevronRight className="h-4 w-4 ml-2" />
      </Button>
    </div>
  );
};
