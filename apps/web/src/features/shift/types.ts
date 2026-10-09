import { z } from 'zod';

export const shiftSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['open', 'closed']),
  opened_at: z.string(),
  opening_cash: z.number().int(),
  expected_cash: z.number().int().nullable(),
  actual_cash: z.number().int().nullable(),
  difference: z.number().int().nullable(),
});

export type Shift = z.infer<typeof shiftSchema>;
