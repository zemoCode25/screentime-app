import { z } from "zod";

export const signupSchema = z.object({
  displayName: z.string().trim().optional(),
  email: z
    .string()
    .trim()
    .min(1, "Email is required.")
    .email("Enter a valid email."),
  password: z.string().min(1, "Password is required."),
});

export type SignupFormValues = z.infer<typeof signupSchema>;
