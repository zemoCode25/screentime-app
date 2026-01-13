import type { Database } from "@/types/database-types";
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient<Database>(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
);
