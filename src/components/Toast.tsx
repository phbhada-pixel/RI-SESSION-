import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

interface ToastProps {
  message: string;
  type?: 'success' | 'error';
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, type = 'success', onClose }) => {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onClose, 4500);
    return () => clearTimeout(timer);
  }, [message, onClose]);

  if (!message) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md no-print">
      <div
        className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg text-sm ${
          type === 'error'
            ? 'bg-rose-50 border-rose-300 text-rose-900'
            : 'bg-emerald-50 border-emerald-300 text-emerald-900'
        }`}
      >
        {type === 'error' ? (
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
        ) : (
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
        )}
        <span className="flex-1">{message}</span>
        <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-800">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
