import { z } from "zod";

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

const daySchema = z.number().int().min(0).max(6);
const timeSchema = z
  .string()
  .regex(TIME_REGEX, "Use 24h format: HH:MM");

const hoursSchema = z
  .string()
  .regex(/^\d+$/, "Enter hours")
  .refine((value) => Number(value) <= 23, "Hours must be 0-23");

const minutesSchema = z
  .string()
  .regex(/^\d+$/, "Enter minutes")
  .refine((value) => Number(value) <= 59, "Minutes must be 0-59");

const bedtimeSchema = z.object({
  days: z.array(daySchema).min(1, "Select at least one day"),
  startTime: timeSchema,
  endTime: timeSchema,
});

const focusSchema = z.object({
  days: z
    .array(daySchema)
    .min(1, "Select at least one weekday")
    .refine(
      (days) => days.every((day) => day >= 1 && day <= 5),
      "Focus time can only be set for weekdays"
    ),
  startTime: timeSchema,
  endTime: timeSchema,
});

export const childConstraintsSchema = z.object({
  bedtimes: z.array(bedtimeSchema),
  focusTimes: z.array(focusSchema),
  dailyLimitHours: hoursSchema,
  dailyLimitMinutes: minutesSchema,
  weekendBonusHours: hoursSchema,
  weekendBonusMinutes: minutesSchema,
});

export type ChildConstraintsFormValues = z.infer<
  typeof childConstraintsSchema
>;
