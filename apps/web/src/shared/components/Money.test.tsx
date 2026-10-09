import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Money } from './Money';

describe('Money', () => {
  it('menampilkan nilai rupiah sebagai integer dengan pemisah Indonesia', () => {
    render(<Money value={12_500} />);
    expect(screen.getByText(/Rp\s12\.500/)).toBeInTheDocument();
  });

  it('menolak nilai uang pecahan', () => {
    expect(() => Money({ value: 12_500.5 })).toThrow(RangeError);
  });
});
