import { NextRequest, NextResponse } from "next/server";
import { searchStories } from "@/lib/news/brief";
import { ensureProfile, getAuthContext } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") ?? "";
  const auth = await getAuthContext(request);
  const profile =
    auth.configured && auth.user && auth.admin
      ? await ensureProfile(auth.admin, auth.user)
      : { membershipTier: "free" as const };
  const stories = await searchStories(query, profile.membershipTier);

  return NextResponse.json({ stories });
}
