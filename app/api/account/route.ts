import { NextResponse } from "next/server";
import { ensureProfile, getAuthContext, loadSavedNewsStories, loadUserState } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const context = await getAuthContext(request);
  if (!context.configured) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  if (!context.user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const user = context.user;
  const [profile, state, savedStories] = await Promise.all([
    ensureProfile(context.admin, user),
    loadUserState(context.admin, user.id),
    loadSavedNewsStories(context.admin, user.id)
  ]);

  return NextResponse.json({ profile, state, savedStories });
}
