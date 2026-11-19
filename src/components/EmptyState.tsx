import React from 'react';

interface EmptyStateProps {
  message: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ message, action }) => {
  return (
    <div className="p-8 text-center text-sm text-slate-500 space-y-3">
      <div>{message}</div>
      {action && <div className="flex justify-center">{action}</div>}
    </div>
  );
};
