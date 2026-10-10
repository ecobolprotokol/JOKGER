import type { ReactNode } from 'react';
import { strings } from '../strings/id';

export function PageHeader({
  title,
  eyebrow = strings.app.operationTitle,
  description,
  actions,
}: {
  title: string;
  eyebrow?: string;
  description?: ReactNode;
  actions?: ReactNode;
}): JSX.Element {
  return (
    <header className="page-heading">
      <div className="page-heading__copy">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {description && <p className="page-heading__description">{description}</p>}
      </div>
      {actions && <div className="page-heading__actions">{actions}</div>}
    </header>
  );
}
