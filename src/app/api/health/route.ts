/**
 * Health Check Endpoint
 *
 * Simple health check for infrastructure monitoring.
 * Returns 200 OK if the service is running.
 */

import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ status: "ok" });
}
