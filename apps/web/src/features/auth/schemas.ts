import { z } from 'zod';
import { strings } from '../../shared/strings/id';

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, strings.auth.passwordCurrentRequired),
    newPassword: z
      .string()
      .min(10, strings.auth.passwordTooShort)
      .max(128, strings.auth.passwordTooLong),
    confirmPassword: z.string().min(1, strings.auth.passwordConfirmRequired),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: strings.auth.passwordMismatch,
    path: ['confirmPassword'],
  })
  .refine((values) => values.currentPassword !== values.newPassword, {
    message: strings.auth.passwordMustChange,
    path: ['newPassword'],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
