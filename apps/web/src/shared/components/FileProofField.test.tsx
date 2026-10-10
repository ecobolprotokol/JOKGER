import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FileProofField, validateProofFile } from './FileProofField';

describe('FileProofField', () => {
  it('accepts JPEG, PNG and WebP with matching magic bytes', async () => {
    const jpeg = new File([new Uint8Array([255, 216, 255, 0])], 'proof.jpg', {
      type: 'image/jpeg',
    });
    const png = new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], 'proof.png', {
      type: 'image/png',
    });
    const webp = new File([new TextEncoder().encode('RIFFxxxxWEBP')], 'proof.webp', {
      type: 'image/webp',
    });

    await expect(validateProofFile(jpeg)).resolves.toBe(true);
    await expect(validateProofFile(png)).resolves.toBe(true);
    await expect(validateProofFile(webp)).resolves.toBe(true);
  });

  it('rejects spoofed content, unsupported MIME types, and files above 5 MiB', async () => {
    const spoofed = new File(['not a png'], 'proof.png', { type: 'image/png' });
    const unsupported = new File(['content'], 'proof.gif', { type: 'image/gif' });
    const large = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'proof.png', {
      type: 'image/png',
    });

    await expect(validateProofFile(spoofed)).resolves.toBe(false);
    await expect(validateProofFile(unsupported)).resolves.toBe(false);
    await expect(validateProofFile(large)).resolves.toBe(false);
  });

  it('reports a validation error and does not select invalid content', async () => {
    const onChange = vi.fn();
    render(<FileProofField file={null} onChange={onChange} />);
    const input = screen.getByLabelText('Unggah bukti pembayaran (opsional)');
    fireEvent.change(input, {
      target: { files: [new File(['bad'], 'bad.png', { type: 'image/png' })] },
    });
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(null, expect.any(String)));
  });
});
