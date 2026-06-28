import { NextResponse } from "next/server";
import { getAuthContext, setStorySaved } from "@/lib/supabase/server";

export async function PUT(request: Request) {
  const context = await getAuthContext(request);
  if (!context.configured) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  if (!context.user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const user = context.user;
  const body = (await request.json()) as { storyId?: string; saved?: boolean };

  if (!body.storyId || typeof body.saved !== "boolean") {
    return NextResponse.json({ error: "Missing storyId or saved." }, { status: 400 });
  }

  await setStorySaved(context.admin, user.id, body.storyId, body.saved);
  return NextResponse.json({ ok: true });
}
