import { z } from 'zod';

export const profileSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email().nullable(),
  full_name: z.string(),
  role: z.enum(['super_admin', 'admin']),
  is_active: z.boolean(),
});

export type Profile = z.infer<typeof profileSchema>;
