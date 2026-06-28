import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "./config";

let client: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient | null {
  const config = getSupabasePublicConfig();
  if (!config) {
    return null;
  }

  if (!client) {
    client = createClient(config.url, config.anonKey);
  }

  return client;
}
