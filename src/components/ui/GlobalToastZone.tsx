import React, { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";

export type ToastType = "success" | "error" | "info";

export interface ToastEventDetail {
  type: ToastType;
  message: string;
}

interface Toast extends ToastEventDetail {
  id: number;
}

const TOAST_EVENT_NAME = "app-toast";

let toastIdCounter = 0;

export const showToast = (detail: ToastEventDetail) => {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent<ToastEventDetail>(TOAST_EVENT_NAME, {
      detail,
    })
  );
};

export const GlobalToastZone: React.FC = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const handleToastEvent = (event: Event) => {
      const customEvent = event as CustomEvent<ToastEventDetail>;
      const { message, type } = customEvent.detail;

      const id = ++toastIdCounter;
      setToasts((prev) => [...prev, { id, message, type }]);

      window.setTimeout(() => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
      }, 5000);
    };

    window.addEventListener(TOAST_EVENT_NAME, handleToastEvent as EventListener);

    return () => {
      window.removeEventListener(TOAST_EVENT_NAME, handleToastEvent as EventListener);
    };
  }, []);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 py-4 pointer-events-none">
      <div className="w-full max-w-xl space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            aria-live="polite"
            className={`pointer-events-auto flex items-start gap-3 rounded-md border px-4 py-3 shadow-lg transition-colors ${
              toast.type === "error"
                ? "border-destructive bg-destructive text-destructive-foreground"
                : toast.type === "success"
                  ? "border-emerald-500 bg-emerald-600 text-emerald-50"
                  : "border-border bg-background text-foreground"
            }`}
          >
            <AlertCircle className="h-4 w-4 mt-0.5" />
            <span className="text-sm">{toast.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
