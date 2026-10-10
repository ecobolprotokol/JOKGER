import { useId, useState } from 'react';
import { strings } from '../strings/id';

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function readPrefix(file: File, length: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (!(reader.result instanceof ArrayBuffer)) {
        reject(new Error('File tidak dapat dibaca.'));
        return;
      }
      resolve(new Uint8Array(reader.result));
    };
    reader.onerror = () => reject(reader.error ?? new Error('File tidak dapat dibaca.'));
    reader.readAsArrayBuffer(file.slice(0, length));
  });
}

export async function validateProofFile(file: File): Promise<boolean> {
  if (file.size > MAX_BYTES || !TYPES.has(file.type)) return false;
  const bytes = await readPrefix(file, 12);
  if (file.type === 'image/jpeg') return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (file.type === 'image/png') return bytes.slice(0, 8).join(',') === '137,80,78,71,13,10,26,10';
  return (
    new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' &&
    new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP'
  );
}

export function FileProofField({
  file,
  onChange,
}: {
  file: File | null;
  onChange: (file: File | null, error: string | null) => void;
}): JSX.Element {
  const id = useId();
  const [checking, setChecking] = useState(false);
  async function selectFile(candidate: File | undefined): Promise<void> {
    if (!candidate) return;
    setChecking(true);
    try {
      const valid = await validateProofFile(candidate);
      onChange(valid ? candidate : null, valid ? null : strings.pos.proofInvalid);
    } catch {
      onChange(null, strings.pos.proofInvalid);
    } finally {
      setChecking(false);
    }
  }
  return (
    <div className="field">
      <label htmlFor={id}>{strings.pos.uploadProof}</label>
      <input
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(event) => void selectFile(event.target.files?.[0])}
      />
      <small>{file?.name ?? strings.pos.proofHint}</small>
      {checking && <span role="status">{strings.app.loading}</span>}
    </div>
  );
}
