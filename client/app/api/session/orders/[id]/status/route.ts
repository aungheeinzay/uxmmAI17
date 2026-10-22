import type { NextRequest } from "next/server";
import { orderStatusSession } from "@/features/auth/server/session";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return orderStatusSession(request, id);
}
