import React from "react";
import { useFlashcardsManagement } from "./useFlashcardsManagement";
import { FlashcardsToolbar } from "./FlashcardsToolbar";
import { UserFlashcardsList } from "./UserFlashcardsList";
import { PaginationControls } from "./PaginationControls";
import { DeleteFlashcardDialog } from "./DeleteFlashcardDialog";
import { FlashcardEditModal } from "../shared/FlashcardEditModal";
import { LoadingOverlay } from "../ui/LoadingOverlay";

export const FlashcardsManagementView: React.FC = () => {
  const {
    state,
    openCreateModal,
    openEditModal,
    closeModal,
    submitCreate,
    submitEdit,
    openDeleteDialog,
    confirmDelete,
    cancelDelete,
    goToPage,
  } = useFlashcardsManagement();

  const { items, pagination, isLoading, isGlobalMutating, activeModal, deleteCandidateId } = state;

  // Derive initial values for edit modal
  const editInitialValues = React.useMemo(() => {
    if (activeModal?.mode === "edit") {
      const item = items.find((i) => i.id === activeModal.flashcardId);
      if (item) {
        return { front: item.front, back: item.back };
      }
    }
    return { front: "", back: "" };
  }, [activeModal, items]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Global loading overlay for initial load or full-page blocking actions */}
      {isLoading && items.length === 0 && <LoadingOverlay />}
      {isGlobalMutating && <LoadingOverlay />}

      <main className="flex-1 container max-w-7xl mx-auto py-8 px-4 space-y-6 pb-24">
        <FlashcardsToolbar isDisabled={isLoading || isGlobalMutating} onCreateClick={openCreateModal} />

        <UserFlashcardsList
          items={items}
          onEditClick={openEditModal}
          onDeleteClick={openDeleteDialog}
          onCreateClick={openCreateModal}
        />

        <PaginationControls
          pagination={pagination}
          isDisabled={isLoading || isGlobalMutating}
          onPageChange={goToPage}
        />
      </main>

      {/* Modals */}
      <FlashcardEditModal
        isOpen={activeModal !== null}
        mode={activeModal?.mode || "create"}
        initialValues={activeModal?.mode === "edit" ? editInitialValues : { front: "", back: "" }}
        id={activeModal?.mode === "edit" ? String(activeModal.flashcardId) : undefined}
        isSubmitting={isGlobalMutating}
        onClose={closeModal}
        onSubmit={async (id, values) => {
          if (activeModal?.mode === "create") {
            await submitCreate(values);
          } else {
            await submitEdit(values);
          }
        }}
      />

      <DeleteFlashcardDialog
        isOpen={deleteCandidateId !== null}
        isDeleting={isGlobalMutating}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </div>
  );
};
