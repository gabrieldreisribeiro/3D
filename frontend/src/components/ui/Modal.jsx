import { useEffect } from 'react';

function Modal({
  open,
  title,
  onClose,
  children,
  footer = null,
  size = 'md',
  closeOnBackdrop = false,
  closeOnEscape = false,
}) {
  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event) => {
      if (closeOnEscape && event.key === 'Escape') onClose();
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose, closeOnEscape]);

  if (!open) return null;

  const sizeClass = size === 'lg' ? 'max-w-4xl' : size === 'sm' ? 'max-w-md' : 'max-w-2xl';

  const handleBackdropClick = () => {
    if (closeOnBackdrop) onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4" onClick={handleBackdropClick}>
      <div
        className={`w-full ${sizeClass} max-h-[92dvh] overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-xl sm:rounded-2xl`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-5">
          <h3 className="break-words text-base font-semibold tracking-tight text-slate-900 sm:text-lg">{title}</h3>
          <button
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:text-slate-900"
            onClick={onClose}
            type="button"
            aria-label="Fechar"
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
        <div className="max-h-[calc(92dvh-138px)] overflow-y-auto px-4 py-4 sm:px-5">{children}</div>
        {footer ? <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-4 py-4 sm:px-5 [&_button]:w-full sm:[&_button]:w-auto">{footer}</div> : null}
      </div>
    </div>
  );
}

export default Modal;
