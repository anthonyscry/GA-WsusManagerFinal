import React, { useEffect, useRef, useCallback } from 'react';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmVariant = 'primary',
  onConfirm,
  onCancel
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  // Handle escape key to close dialog
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onCancel();
    }
  }, [onCancel]);

  // Set up keyboard listener and focus management
  useEffect(() => {
    if (isOpen) {
      // Add escape key listener
      document.addEventListener('keydown', handleKeyDown);
      // Focus the cancel button for accessibility
      setTimeout(() => cancelButtonRef.current?.focus(), 0);

      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const variantStyles = {
    danger: 'bg-rose-600 hover:bg-rose-500 focus:ring-rose-500',
    primary: 'bg-blue-600 hover:bg-blue-500 focus:ring-blue-500'
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-2xl"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-message"
    >
      <div
        ref={dialogRef}
        className="bg-[#121216] w-full max-w-md rounded-2xl border border-slate-800 shadow-2xl overflow-hidden animate-scaleIn"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-slate-800">
          <h3 id="confirm-dialog-title" className="text-lg font-black text-white uppercase tracking-tight">
            {title}
          </h3>
        </div>
        <div className="p-6">
          <p id="confirm-dialog-message" className="text-sm text-slate-300 leading-relaxed">
            {message}
          </p>
        </div>
        <div className="p-6 bg-black/40 border-t border-slate-800 flex gap-3">
          <button
            ref={cancelButtonRef}
            onClick={onCancel}
            className="flex-1 py-3 px-4 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg text-sm font-semibold uppercase tracking-widest transition-all focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
            aria-label={cancelLabel}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-3 px-4 text-white rounded-lg text-sm font-semibold uppercase tracking-widest transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 ${variantStyles[confirmVariant]}`}
            aria-label={confirmLabel}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
