import { NextRequest, NextResponse } from "next/server";

const OPUS_API = "https://api.opus.pro/api";
const API_KEY = process.env.OPUS_API_KEY!;
const ORG_ID = process.env.OPUS_ORG_ID!;

// Opus clip shape from exportable-clips endpoint
interface OpusClip {
  id: string; // "projectId.curationId"
  projectId: string;
  curationId: string;
  uriForPreview: string;
  uriForExport: string;
  durationMs: number;
  timeRanges: number[][];
  keywords: string[];
  title?: string;
  transcript?: string;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  try {
    if (!API_KEY) {
      return NextResponse.json({ clips: [], error: "OPUS_API_KEY not configured" });
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${API_KEY}`,
    };
    if (ORG_ID) headers["x-opus-org-id"] = ORG_ID;

    const url = `${OPUS_API}/exportable-clips?q=findByProjectId&projectId=${encodeURIComponent(projectId)}`;
    const response = await fetch(url, { headers });

    if (!response.ok) {
      // Project might still be processing - return empty
      if (response.status === 404) {
        return NextResponse.json({ clips: [], status: "processing" });
      }
      throw new Error(`Opus API error (${response.status})`);
    }

    const rawBody = await response.json();

    // Opus exportable-clips API can return either:
    //   - An array of clips (when clips are ready)
    //   - An object { data: [...], total: N } (paginated)
    //   - An object { projectId, stage, ... } (when still processing)
    const rawClips: OpusClip[] = Array.isArray(rawBody)
      ? rawBody
      : Array.isArray(rawBody?.data)
        ? rawBody.data
        : Array.isArray(rawBody?.clips)
          ? rawBody.clips
          : [];

    if (rawClips.length === 0 && !Array.isArray(rawBody)) {
      // Response looks like a status object (still processing or not found)
      return NextResponse.json({ clips: [], status: rawBody?.stage === "DONE" ? "done" : "processing" });
    }

    const clips = rawClips.map((c) => {
      // Extract clipId from composite id "projectId.curationId"
      const parts = c.id.split(".");
      const clipId = parts.length > 1 ? parts.slice(1).join(".") : c.id;
      const duration = Math.round(c.durationMs / 1000);
      const timeStart = c.timeRanges?.[0]?.[0] ?? 0;
      const timeEnd = c.timeRanges?.[0]?.[1] ?? duration;

      return {
        clipId,
        projectId: c.projectId,
        title: c.title || `Clip ${clipId}`,
        duration,
        durationMs: c.durationMs,
        previewUrl: c.uriForPreview,
        exportUrl: c.uriForExport,
        start: timeStart,
        end: timeEnd,
        keywords: c.keywords || [],
        transcript: c.transcript || "",
        // Legacy compatibility fields
        hook: c.title || "Opus AI Clip",
        type: c.keywords?.[0] || "Highlight",
        score: 0,
      };
    });

    return NextResponse.json({ clips });
  } catch (err: any) {
    console.error("Clips fetch error:", err);
    return NextResponse.json({ clips: [], error: err.message });
  }
}
