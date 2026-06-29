import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "./config";

let client: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient | null {
  const config = getSupabasePublicConfig();
  if (!config) {
    return null;
  }

  if (!client) {
    client = createBrowserClient(config.url, config.anonKey);
  }

  return client;
}
