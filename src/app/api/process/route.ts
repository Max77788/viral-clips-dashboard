import { NextRequest, NextResponse } from "next/server";

const OPUS_API = "https://api.opus.pro/api";
const API_KEY = process.env.OPUS_API_KEY!;
const ORG_ID = process.env.OPUS_ORG_ID!;

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url) return NextResponse.json({ error: "URL required" }, { status: 400 });

    if (!API_KEY) {
      return NextResponse.json(
        { error: "OPUS_API_KEY not configured" },
        { status: 500 }
      );
    }

    // Create clip project via Opus Pro API
    const body: Record<string, unknown> = {
      videoUrl: url.trim(),
    };

    // Add webhook for async completion notification
    body.conclusionActions = [
      {
        type: "WEBHOOK",
        url: "https://n8n.mom-ai-agency.site/webhook/opus-project-done",
        notifyFailure: true,
      },
    ];

    const headers: Record<string, string> = {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    };
    if (ORG_ID) headers["x-opus-org-id"] = ORG_ID;

    const response = await fetch(`${OPUS_API}/clip-projects`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Opus API error (${response.status}): ${errText}`);
    }

    const project = await response.json();
    const projectId = project.id || project.projectId;

    return NextResponse.json({
      projectId,
      status: "processing",
      message: "Opus Pro is analyzing your video and extracting clips...",
    });
  } catch (err: any) {
    console.error("Process error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
