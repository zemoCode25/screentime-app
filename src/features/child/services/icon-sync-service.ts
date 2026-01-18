import { supabase } from "@/lib/supabase";
import { fetchAppIconBase64 } from "@/src/lib/usage-stats";
import { decode } from "base64-arraybuffer";

const MAX_ICONS_TO_SYNC = 20;
const ICON_BUCKET = "app-icons";

type AppWithUsage = {
  packageName: string;
  totalSeconds: number;
  iconUrl: string | null;
};

/**
 * Syncs icons for the top N apps by usage that don't already have an icon_url.
 * Only runs on Android devices with the native module available.
 */
export async function syncAppIconsForTopApps(
  childId: string,
  apps: AppWithUsage[]
): Promise<number> {
  // Sort by usage and filter to apps without icons
  const appsNeedingIcons = apps
    .filter((app) => app.totalSeconds > 0 && !app.iconUrl)
    .sort((a, b) => b.totalSeconds - a.totalSeconds)
    .slice(0, MAX_ICONS_TO_SYNC);

  if (appsNeedingIcons.length === 0) {
    return 0;
  }

  let successCount = 0;

  for (const app of appsNeedingIcons) {
    try {
      const iconBase64 = await fetchAppIconBase64(app.packageName);
      if (!iconBase64) {
        continue;
      }

      // Upload to Supabase Storage
      const filePath = `${childId}/${app.packageName}.png`;
      const { error: uploadError } = await supabase.storage
        .from(ICON_BUCKET)
        .upload(filePath, decode(iconBase64), {
          contentType: "image/png",
          upsert: true,
        });

      if (uploadError) {
        console.warn(
          `Failed to upload icon for ${app.packageName}:`,
          uploadError
        );
        continue;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(ICON_BUCKET)
        .getPublicUrl(filePath);

      if (!urlData?.publicUrl) {
        continue;
      }

      // Update child_apps record with icon URL
      const { error: updateError } = await supabase
        .from("child_apps")
        .update({ icon_url: urlData.publicUrl })
        .eq("child_id", childId)
        .eq("package_name", app.packageName);

      if (updateError) {
        console.warn(
          `Failed to update icon URL for ${app.packageName}:`,
          updateError
        );
        continue;
      }

      successCount += 1;
    } catch (err) {
      console.warn(`Error syncing icon for ${app.packageName}:`, err);
    }
  }

  return successCount;
}
