import { NextResponse } from "next/server";
import { getDailyBrief } from "@/lib/news/brief";
import { ensureProfile, getAuthContext } from "@/lib/supabase/server";

export const revalidate = 600;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const auth = await getAuthContext(request);
  const profile =
    auth.configured && auth.user && auth.admin
      ? await ensureProfile(auth.admin, auth.user)
      : { membershipTier: "free" as const };
  const brief = await getDailyBrief({
    force: url.searchParams.get("refresh") === "1",
    membershipTier: profile.membershipTier
  });

  return NextResponse.json(brief, {
    headers: {
      "Cache-Control": "private, max-age=0, s-maxage=600, stale-while-revalidate=900"
    }
  });
}
