import { z } from "zod";

/**
 * Zod schema for app limit form validation
 */
export const appLimitSchema = z
  .object({
    // Time limit in hours and minutes (as strings for input fields)
    limitHours: z
      .string()
      .regex(/^\d*$/, "Must be a number")
      .transform((val) => (val === "" ? "0" : val)),
    limitMinutes: z
      .string()
      .regex(/^\d*$/, "Must be a number")
      .refine((val) => val === "" || Number(val) < 60, "Minutes must be 0-59")
      .transform((val) => (val === "" ? "0" : val)),

    // Days the limit applies
    appliesSun: z.boolean(),
    appliesMon: z.boolean(),
    appliesTue: z.boolean(),
    appliesWed: z.boolean(),
    appliesThu: z.boolean(),
    appliesFri: z.boolean(),
    appliesSat: z.boolean(),

    // Bonus settings
    bonusEnabled: z.boolean(),
    bonusHours: z
      .string()
      .regex(/^\d*$/, "Must be a number")
      .transform((val) => (val === "" ? "0" : val)),
    bonusMinutes: z
      .string()
      .regex(/^\d*$/, "Must be a number")
      .refine((val) => val === "" || Number(val) < 60, "Minutes must be 0-59")
      .transform((val) => (val === "" ? "0" : val)),
    bonusStreakTarget: z
      .string()
      .regex(/^\d*$/, "Must be a number")
      .transform((val) => (val === "" ? "3" : val)),
  })
  .refine(
    (data) => {
      const totalMinutes =
        Number(data.limitHours) * 60 + Number(data.limitMinutes);
      return totalMinutes > 0;
    },
    {
      message: "Time limit must be at least 1 minute",
      path: ["limitMinutes"],
    }
  )
  .refine(
    (data) => {
      // At least one day must be selected
      return (
        data.appliesSun ||
        data.appliesMon ||
        data.appliesTue ||
        data.appliesWed ||
        data.appliesThu ||
        data.appliesFri ||
        data.appliesSat
      );
    },
    {
      message: "Select at least one day",
      path: ["appliesSun"],
    }
  );

export type AppLimitFormValues = z.infer<typeof appLimitSchema>;

export const DEFAULT_APP_LIMIT_VALUES: AppLimitFormValues = {
  limitHours: "1",
  limitMinutes: "0",
  appliesSun: true,
  appliesMon: true,
  appliesTue: true,
  appliesWed: true,
  appliesThu: true,
  appliesFri: true,
  appliesSat: true,
  bonusEnabled: false,
  bonusHours: "0",
  bonusMinutes: "30",
  bonusStreakTarget: "3",
};
