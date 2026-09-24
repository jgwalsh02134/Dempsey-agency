import { Link } from "react-router-dom";

interface EmptyStateProps {
  title: string;
  body: string;
  action?: { href: string; label: string; external?: boolean };
}

export function EmptyState({ title, body, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <h2 className="empty-state-title">{title}</h2>
      <p className="empty-state-body">{body}</p>
      {action &&
        (action.external ? (
          <a className="btn-hero btn-hero-primary" href={action.href}>
            {action.label}
          </a>
        ) : (
          <Link className="btn-hero btn-hero-primary" to={action.href}>
            {action.label}
          </Link>
        ))}
    </div>
  );
}
