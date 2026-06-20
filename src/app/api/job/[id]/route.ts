import { NextRequest, NextResponse } from "next/server";

const OPUS_API = "https://api.opus.pro/api";
const API_KEY = process.env.OPUS_API_KEY!;
const ORG_ID = process.env.OPUS_ORG_ID!;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  try {
    if (!API_KEY) {
      return NextResponse.json(
        { status: "error", error: "OPUS_API_KEY not configured" },
        { status: 500 }
      );
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${API_KEY}`,
    };
    if (ORG_ID) headers["x-opus-org-id"] = ORG_ID;

    // Get project details to check status/stage
    const response = await fetch(
      `${OPUS_API}/clip-projects/${encodeURIComponent(projectId)}`,
      { headers }
    );

    if (!response.ok) {
      return NextResponse.json(
        { status: "not_found" },
        { status: 404 }
      );
    }

    const project = await response.json();
    const stage = project.stage || "PROCESSING";

    // Opus stages: PENDING, QUEUED, IMPORT, TRANSCRIBE, CURATE, RENDER, DONE, FAILED
    const isDone = stage === "DONE";
    const isFailed = stage === "FAILED";

    return NextResponse.json({
      projectId: project.id || project.projectId,
      url: project.sourceUri || "",
      status: isDone ? "done" : isFailed ? "failed" : "processing",
      stage,
      sourcePlatform: project.sourcePlatform,
      clipCount: project.clipCount,
      error: isFailed ? "Opus processing failed" : undefined,
    });
  } catch (err: any) {
    console.error("Job status error:", err);
    return NextResponse.json(
      { status: "error", error: err.message },
      { status: 500 }
    );
  }
}
