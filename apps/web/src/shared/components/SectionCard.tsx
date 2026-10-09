export function SectionCard({
  title,
  children,
  actions,
}: {
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}): JSX.Element {
  return (
    <section className="section-card">
      <header className="section-card__header">
        <h2 className="section-card__title">{title}</h2>
        {actions && <div className="section-card__actions">{actions}</div>}
      </header>
      <div className="section-card__content">{children}</div>
    </section>
  );
}
