import type { NextResponse } from "next/server";

const RESEND_FROM = "Viral Clip Machine <clips@email.mom-ai-agency.site>";

interface ClipItem {
  clipId?: string;
  title?: string;
  hook?: string;
  duration?: number;
  durationMs?: number;
  previewUrl?: string;
  exportUrl?: string;
  type?: string;
  keywords?: string[];
  transcript?: string;
}

export async function sendClipNotification(params: {
  email: string;
  projectId: string;
  clips: ClipItem[];
  sourceUrl?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }

  const clipList = params.clips
    .map(
      (c: any, i: number) =>
        `Clip ${i + 1}: ${c.title || c.hook || `Clip ${c.clipId}`} (${c.duration || Math.round((c.durationMs || 0) / 1000)}s)`
    )
    .filter(Boolean)
    .join("\n");

  const previewClips = params.clips
    .map((c: any, i: number) => {
      const previewUrl = c.previewUrl || c.exportUrl || "";
      return `
        <div style="margin-bottom:20px;padding:15px;background:#1a1a1a;border-radius:8px;">
          ${
            previewUrl
              ? `<video src="${previewUrl}" controls style="width:100%;max-width:300px;border-radius:8px;margin-bottom:12px;"></video>`
              : ""
          }
          <span style="background:#e5a500;color:#000;padding:2px 8px;border-radius:4px;font-size:12px;">${
            c.type || c.keywords?.[0] || "Highlight"
          }</span>
          <span style="color:#888;margin-left:10px;">${c.duration || Math.round((c.durationMs || 0) / 1000)}s</span>
          <p style="color:#fff;font-size:16px;margin:8px 0;">🪝 <strong>${c.title || c.hook || `Clip ${i + 1}`}</strong></p>
          ${c.transcript ? `<p style="color:#999;font-size:13px;">${c.transcript.slice(0, 200)}...</p>` : ""}
        </div>
      `;
    })
    .join("");

  const html = `
    <h2>🎬 Viral Clips Ready for Review</h2>
    <p><strong>Source:</strong> <a href="${params.sourceUrl || "#"}">${params.sourceUrl || "Opus Pro Project"}</a></p>
    <p><strong>Project ID:</strong> ${params.projectId}</p>
    <p><strong>Clips found:</strong> ${params.clips.length}</p>
    <hr />
    ${previewClips}
    <hr />
    <a href="https://viral-clips-dashboard.vercel.app/clips/${params.projectId}"
       style="display:inline-block;padding:12px 24px;background:#e5a500;color:#000;text-decoration:none;border-radius:8px;font-weight:bold;">
      Review & Schedule →
    </a>
  `;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: params.email,
      subject: `🎬 ${params.clips.length} viral clips extracted — review & schedule`,
      html,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    return { ok: false, error: `Resend error: ${err}` };
  }

  return { ok: true };
}
