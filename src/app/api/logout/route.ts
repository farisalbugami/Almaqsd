import { NextResponse } from "next/server";
import { destroySession, getSession, logAction } from "@/lib/auth";

export async function POST(req: Request) {
  const s = await getSession();
  if (s) await logAction(s.userId, "LOGOUT", "User", s.userId, `خروج ${s.name}`);
  await destroySession();
  return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
}
