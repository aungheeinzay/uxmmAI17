import type { NextRequest } from "next/server";
import { riderManagementSession } from "@/features/riders/server/rider-management.session";
export function POST(request: NextRequest) { return riderManagementSession(request); }
