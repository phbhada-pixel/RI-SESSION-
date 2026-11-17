import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  description: string;
  details?: string[];
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'primary' | 'danger';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  open,
  title,
  description,
  details,
  confirmLabel = 'होय, जतन करा',
  cancelLabel = 'रद्द करा',
  variant = 'primary',
  loading = false,
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md bg-white rounded-xl border border-slate-200 shadow-xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2 rounded-lg ${
                variant === 'danger' ? 'bg-rose-50 text-rose-700' : 'bg-teal-50 text-teal-700'
              }`}
            >
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="p-1 text-slate-400 hover:text-slate-700 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-slate-700 leading-relaxed">{description}</p>

        {details && details.length > 0 && (
          <ul className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1 text-xs text-slate-700 max-h-40 overflow-y-auto">
            {details.map((d, i) => (
              <li key={i} className="truncate">
                • {d}
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 text-sm font-semibold text-white rounded-lg whitespace-nowrap disabled:opacity-60 ${
              variant === 'danger'
                ? 'bg-rose-700 hover:bg-rose-800'
                : 'bg-teal-700 hover:bg-teal-800'
            }`}
          >
            {loading ? 'प्रक्रिया सुरू...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
