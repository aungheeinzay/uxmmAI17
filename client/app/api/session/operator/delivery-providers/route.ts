import type { NextRequest } from "next/server";
import { providersSession } from "@/features/operator/server/providers.session";
export function POST(request: NextRequest) { return providersSession(request); }
