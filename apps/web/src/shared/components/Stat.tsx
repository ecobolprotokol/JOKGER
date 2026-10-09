export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}): JSX.Element {
  return (
    <div className="stat">
      <span className="stat__label">{label}</span>
      <div className="stat__value">{value}</div>
      {hint && <span className="stat__hint">{hint}</span>}
    </div>
  );
}
