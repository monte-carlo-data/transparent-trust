import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      branding: {
        appName: "Transparent Trust",
        tagline: "Turn your knowledge into trustworthy answers. An LLM-powered assistant telling you not just the answer, but why.",
        sidebarSubtitle: "Transparent LLM Assistant",
        primaryColor: "#0ea5e9",
      },
    },
  });
}
