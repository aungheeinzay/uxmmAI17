import type { NextRequest } from "next/server";
import { riderProfileSession } from "@/features/rider-profile/server/rider-profile.session";

export function POST(request: NextRequest) {
  return riderProfileSession(request, "get");
}
