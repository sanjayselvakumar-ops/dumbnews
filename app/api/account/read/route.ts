import { NextResponse } from "next/server";
import { getAuthContext, saveStoryRead } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const context = await getAuthContext(request);
  if (!context.configured) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  if (!context.user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const user = context.user;
  const body = (await request.json()) as { storyId?: string };

  if (!body.storyId) {
    return NextResponse.json({ error: "Missing storyId." }, { status: 400 });
  }

  await saveStoryRead(context.admin, user.id, body.storyId);
  return NextResponse.json({ ok: true });
}
