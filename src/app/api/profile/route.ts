import { NextResponse } from "next/server";
import { PROFILE_BY_KEY } from "@/lib/profiles";

export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const u = new URL(req.url);
  const key = u.searchParams.get("key") || "";
  const back = u.searchParams.get("back") || "/";
  const res = NextResponse.redirect(new URL(back.startsWith("/") ? back : "/", u.origin));
  if (PROFILE_BY_KEY[key]) res.cookies.set("hrt_profile", key, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  return res;
}
