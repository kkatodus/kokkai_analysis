import { NextResponse } from "next/server";
import { clearAuthCookies } from "@/app/lib/authCookies";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  clearAuthCookies(response);
  return response;
}
