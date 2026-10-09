import { NextResponse } from "next/server";
import { getNetworkStatus } from "@/lib/network";

export const dynamic = "force-dynamic";

export async function GET() {
  const status = await getNetworkStatus();
  return NextResponse.json(status, {
    headers: { "Cache-Control": "no-store" },
  });
}
