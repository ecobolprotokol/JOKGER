export function KeyboardHint({
  keys,
}: {
  keys: { key: string; description: string }[];
}): JSX.Element {
  return (
    <div className="keyboard-hint" role="list" aria-label="Pintasan keyboard">
      {keys.map(({ key, description }, index) => (
        <div key={index} className="keyboard-hint__item">
          <kbd className="keyboard-hint__key">{key}</kbd>
          <span className="keyboard-hint__desc">{description}</span>
        </div>
      ))}
    </div>
  );
}
