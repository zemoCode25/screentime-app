import type { Database } from "@/types/database-types";

export type AppCategory = Database["public"]["Enums"]["app_category"];

const CATEGORY_LABELS: Record<AppCategory, string> = {
  education: "Education",
  games: "Games",
  video: "Video",
  social: "Social",
  creativity: "Creativity",
  productivity: "Productivity",
  communication: "Communication",
  utilities: "Utilities",
  other: "Other",
};

const PACKAGE_CATEGORY_OVERRIDES: Record<string, AppCategory> = {
  "com.google.android.youtube": "video",
  "com.google.android.apps.youtube.kids": "video",
  "com.netflix.mediaclient": "video",
  "com.disney.disneyplus": "video",
  "com.amazon.avod.thirdpartyclient": "video",
  "com.roblox.client": "games",
  "com.mojang.minecraftpe": "games",
  "com.supercell.clashofclans": "games",
  "com.supercell.clashroyale": "games",
  "com.android.chrome": "productivity",
  "com.google.android.gm": "communication",
  "com.google.android.apps.docs": "productivity",
  "com.google.android.apps.docs.editors.sheets": "productivity",
  "com.google.android.apps.docs.editors.slides": "productivity",
  "com.whatsapp": "communication",
  "com.facebook.orca": "communication",
  "com.discord": "communication",
  "com.snapchat.android": "social",
  "com.instagram.android": "social",
  "com.facebook.katana": "social",
  "com.zhiliaoapp.musically": "social",
};

export const APP_CATEGORY_ORDER: AppCategory[] = [
  "education",
  "games",
  "video",
  "social",
  "creativity",
  "productivity",
  "communication",
  "utilities",
  "other",
];

export function getAppCategoryLabel(category: AppCategory) {
  return CATEGORY_LABELS[category] ?? "Other";
}

export function resolveAppCategory(
  category: string | null | undefined,
  packageName?: string | null
) {
  const normalizedCategory = category?.trim().toLowerCase() ?? "other";
  const baseCategory = APP_CATEGORY_ORDER.includes(
    normalizedCategory as AppCategory
  )
    ? (normalizedCategory as AppCategory)
    : "other";

  if (baseCategory !== "other") {
    return baseCategory;
  }

  const normalizedPackage = packageName?.trim().toLowerCase();
  if (!normalizedPackage) {
    return baseCategory;
  }

  return PACKAGE_CATEGORY_OVERRIDES[normalizedPackage] ?? baseCategory;
}
