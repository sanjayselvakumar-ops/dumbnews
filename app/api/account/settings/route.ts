import { NextResponse } from "next/server";
import type { StoredState } from "@/lib/app-storage";
import { getAuthContext, saveUserSettings } from "@/lib/supabase/server";

export async function PUT(request: Request) {
  const context = await getAuthContext(request);
  if (!context.configured) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  if (!context.user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const user = context.user;
  const body = (await request.json()) as { settings?: StoredState["settings"] };

  if (!body.settings) {
    return NextResponse.json({ error: "Missing settings." }, { status: 400 });
  }

  await saveUserSettings(context.admin, user.id, body.settings);
  return NextResponse.json({ ok: true });
}
