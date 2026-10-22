import type { NextRequest } from "next/server";
import { incidentsSession } from "@/features/incidents/server/incidents.session";

export function POST(request: NextRequest) {
  return incidentsSession(request, "operatorDetail");
}
