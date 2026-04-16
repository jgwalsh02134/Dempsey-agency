import type { ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  description?: string;
  initial?: string;
  actions?: ReactNode;
};

export function EmptyState({ title, description, initial, actions }: EmptyStateProps) {
  return (
    <div className="empty-state" role="status">
      {initial && (
        <span className="empty-state-icon" aria-hidden="true">
          {initial}
        </span>
      )}
      <h2>{title}</h2>
      {description && <p>{description}</p>}
      {actions && <div className="empty-state-actions">{actions}</div>}
    </div>
  );
}
