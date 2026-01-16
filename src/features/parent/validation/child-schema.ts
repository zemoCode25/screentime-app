import { z } from "zod";

import { Constants, type Database } from "@/types/database-types";

type MotivationType = Database["public"]["Enums"]["motivation_type"];

const motivationEnum = z.enum(
  Constants.public.Enums.motivation_type as [
    MotivationType,
    ...MotivationType[],
  ]
);

export const childSchema = z.object({
  name: z.string().trim().min(1, "Child name is required."),
  childEmail: z
    .string()
    .trim()
    .min(1, "Child email is required.")
    .email("Enter a valid email."),
  age: z
    .string()
    .trim()
    .min(1, "Age is required.")
    .refine((value) => {
      const parsed = Number(value);
      return Number.isInteger(parsed) && parsed >= 1 && parsed <= 18;
    }, "Enter an age between 1 and 18."),
  gradeLevel: z.string().trim().optional(),
  interests: z.array(z.string()).min(1, "Select at least one interest."),
  motivations: z
    .array(motivationEnum)
    .min(1, "Select at least one motivation."),
});

export type ChildFormValues = z.infer<typeof childSchema>;
export type MotivationValue = z.infer<typeof motivationEnum>;
