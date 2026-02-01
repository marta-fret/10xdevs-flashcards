import { useState, useEffect, useCallback } from "react";
import type { FlashcardListItemViewModel, FlashcardsListQueryViewModel, FlashcardFormValues } from "./types";
import type { PaginationMetaDto } from "../../types";
import { useFlashcardsList, useCreateFlashcards, useUpdateFlashcard, useDeleteFlashcard } from "../hooks";
import { showToast } from "../ui/GlobalToastZone";

interface FlashcardsViewState {
  items: FlashcardListItemViewModel[];
  pagination: PaginationMetaDto | null;
  query: FlashcardsListQueryViewModel;
  isLoading: boolean;
  isGlobalMutating: boolean;
  listError?: string;
  mutationError?: string;
  activeModal: null | { mode: "create" } | { mode: "edit"; flashcardId: number };
  deleteCandidateId: number | null;
}

interface UseFlashcardsManagementResult {
  state: FlashcardsViewState;
  openCreateModal: () => void;
  openEditModal: (id: number) => void;
  closeModal: () => void;
  submitCreate: (values: FlashcardFormValues) => Promise<void>;
  submitEdit: (values: FlashcardFormValues) => Promise<void>;
  openDeleteDialog: (id: number) => void;
  confirmDelete: () => Promise<void>;
  cancelDelete: () => void;
  goToPage: (page: number) => void;
}

export const useFlashcardsManagement = (): UseFlashcardsManagementResult => {
  // State
  const [items, setItems] = useState<FlashcardListItemViewModel[]>([]);
  const [pagination, setPagination] = useState<PaginationMetaDto | null>(null);
  const [query, setQuery] = useState<FlashcardsListQueryViewModel>({
    page: 1,
    limit: 12,
    sort: "created_at",
    order: "desc",
  });

  const [activeModal, setActiveModal] = useState<FlashcardsViewState["activeModal"]>(null);
  const [deleteCandidateId, setDeleteCandidateId] = useState<number | null>(null);

  // API Hooks
  const { fetchList, isLoading: isListLoading, error: listError } = useFlashcardsList();
  const { create, isLoading: isCreating, error: createError } = useCreateFlashcards();
  const { update, isLoading: isUpdating, error: updateError } = useUpdateFlashcard();
  const { remove, isLoading: isDeleting, error: deleteError } = useDeleteFlashcard();

  const isGlobalMutating = isCreating || isUpdating || isDeleting;
  const mutationError = createError || updateError || deleteError || undefined;

  // Load list
  const loadFlashcards = useCallback(async () => {
    const response = await fetchList(query);
    if (response) {
      setItems(
        response.items.map((dto) => ({
          ...dto,
          generationId: dto.generation_id,
          createdAt: dto.created_at,
          updatedAt: dto.updated_at,
          isUpdating: false,
          isDeleting: false,
        }))
      );
      setPagination(response.pagination);
    }
  }, [fetchList, query]);

  useEffect(() => {
    loadFlashcards();
  }, [loadFlashcards]);

  // Handlers
  const openCreateModal = () => setActiveModal({ mode: "create" });

  const openEditModal = (id: number) => setActiveModal({ mode: "edit", flashcardId: id });

  const closeModal = () => setActiveModal(null);

  const submitCreate = async (values: FlashcardFormValues) => {
    const response = await create({
      flashcards: [
        {
          front: values.front,
          back: values.back,
          source: "manual",
          generation_id: null,
        },
      ],
    });

    if (response) {
      showToast({ type: "success", message: "Flashcard created successfully" });
      closeModal();
      loadFlashcards(); // Refetch to see new item
    } else {
      showToast({ type: "error", message: "Failed to create flashcard" });
    }
  };

  const submitEdit = async (values: FlashcardFormValues) => {
    if (activeModal?.mode !== "edit") return;

    const id = activeModal.flashcardId;

    // Optimistic update (optional, but good for UI responsiveness)
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, isUpdating: true } : item)));

    const response = await update(id, {
      front: values.front,
      back: values.back,
    });

    if (response) {
      showToast({ type: "success", message: "Flashcard updated successfully" });
      closeModal();

      // Update local state without full refetch if possible, or just refetch
      // For now, let's update local state to avoid full reload flicker
      setItems((prev) =>
        prev.map((item) => {
          if (item.id === id) {
            return {
              ...item,
              front: response.front,
              back: response.back,
              updatedAt: response.updated_at,
              isUpdating: false,
            };
          }
          return item;
        })
      );
    } else {
      showToast({ type: "error", message: "Failed to update flashcard" });
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, isUpdating: false } : item)));
    }
  };

  const openDeleteDialog = (id: number) => setDeleteCandidateId(id);

  const cancelDelete = () => setDeleteCandidateId(null);

  const confirmDelete = async () => {
    if (deleteCandidateId === null) return;

    const id = deleteCandidateId;
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, isDeleting: true } : item)));

    const response = await remove(id);

    if (response) {
      showToast({ type: "success", message: "Flashcard deleted successfully" });
      setDeleteCandidateId(null);
      loadFlashcards(); // Refetch to update pagination
    } else {
      showToast({ type: "error", message: "Failed to delete flashcard" });
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, isDeleting: false } : item)));
    }
  };

  const goToPage = (page: number) => {
    setQuery((prev) => ({ ...prev, page }));
  };

  return {
    state: {
      items,
      pagination,
      query,
      isLoading: isListLoading,
      isGlobalMutating,
      listError: listError || undefined,
      mutationError,
      activeModal,
      deleteCandidateId,
    },
    openCreateModal,
    openEditModal,
    closeModal,
    submitCreate,
    submitEdit,
    openDeleteDialog,
    confirmDelete,
    cancelDelete,
    goToPage,
  };
};
