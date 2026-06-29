import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getDailyBrief } from "@/lib/news/brief";
import { DumbNewsApp } from "@/components/dumb-news-app";
import { RegisterServiceWorker } from "@/components/register-service-worker";
import { getSupabasePublicConfig } from "@/lib/supabase/config";
import { ensureProfile, getSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AppPage() {
  const publicConfig = getSupabasePublicConfig();
  const admin = getSupabaseAdminClient();
  let membershipTier: "free" | "paid" = "free";

  if (publicConfig && admin) {
    const cookieStore = await cookies();
    const supabase = createServerClient(publicConfig.url, publicConfig.anonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          return undefined;
        }
      }
    });
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (user) {
      const profile = await ensureProfile(admin, user);
      membershipTier = profile.membershipTier;
    }
  }

  const brief = await getDailyBrief({ membershipTier });

  return (
    <>
      <DumbNewsApp initialBrief={brief} />
      <RegisterServiceWorker />
    </>
  );
}
