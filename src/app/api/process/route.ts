import { NextRequest, NextResponse } from "next/server";

const OPUS_API = "https://api.opus.pro/api";
const API_KEY = process.env.OPUS_API_KEY!;
const ORG_ID = process.env.OPUS_ORG_ID!;

export async function POST(req: NextRequest) {
  try {
    const { url, email } = await req.json();
    if (!url) return NextResponse.json({ error: "URL required" }, { status: 400 });
    if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    if (!API_KEY) {
      return NextResponse.json(
        { error: "OPUS_API_KEY not configured" },
        { status: 500 }
      );
    }

    // Build webhook URL with email so the webhook knows who to notify
    const encodedEmail = encodeURIComponent(email.trim());
    const webhookUrl = `https://viral-clips-dashboard.vercel.app/api/opus-webhook?email=${encodedEmail}`;

    // Create clip project via Opus Pro API
    const body: Record<string, unknown> = {
      videoUrl: url.trim(),
    };

    // Add webhook for async completion notification
    body.conclusionActions = [
      {
        type: "WEBHOOK",
        url: webhookUrl,
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
