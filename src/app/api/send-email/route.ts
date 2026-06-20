import { NextRequest, NextResponse } from "next/server";

const GUILLERMO_EMAIL = "guillermo@example.com";

export async function POST(req: NextRequest) {
  try {
    const { projectId, clips, url } = await req.json();

    const clipList = clips
      .map(
        (c: any, i: number) =>
          `Clip ${i + 1}: ${c.title || c.hook || `Clip ${c.clipId}`} (${c.duration || c.durationMs / 1000}s)`
      )
      .join("\n");

    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      return NextResponse.json(
        { error: "Email not configured — add RESEND_API_KEY" },
        { status: 500 }
      );
    }

    const previewClips = clips.map((c: any, i: number) => {
      const previewUrl = c.previewUrl || c.exportUrl || "";
      return `
        <div style="margin-bottom:20px;padding:15px;background:#1a1a1a;border-radius:8px;">
          ${previewUrl ? `<video src="${previewUrl}" controls style="width:100%;max-width:300px;border-radius:8px;margin-bottom:12px;"></video>` : ""}
          <span style="background:#e5a500;color:#000;padding:2px 8px;border-radius:4px;font-size:12px;">${c.type || c.keywords?.[0] || "Highlight"}</span>
          <span style="color:#888;margin-left:10px;">${c.duration || Math.round(c.durationMs / 1000)}s</span>
          <p style="color:#fff;font-size:16px;margin:8px 0;">🪝 <strong>${c.title || c.hook || `Clip ${i + 1}`}</strong></p>
          ${c.transcript ? `<p style="color:#999;font-size:13px;">${c.transcript.slice(0, 200)}...</p>` : ""}
        </div>
      `;
    }).join("");

    const html = `
      <h2>🎬 New Viral Clips Ready for Review</h2>
      <p><strong>Source:</strong> <a href="${url || '#'}">${url || "Opus Pro Project"}</a></p>
      <p><strong>Project ID:</strong> ${projectId}</p>
      <p><strong>Clips found:</strong> ${clips.length}</p>
      <hr />
      ${previewClips}
      <hr />
      <a href="https://viral-clips-dashboard.vercel.app/clips/${projectId}"
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
        from: "Viral Clip Machine <clips@email.mom-ai-agency.site>",
        to: GUILLERMO_EMAIL,
        subject: `🎬 ${clips.length} viral clips extracted — review & schedule`,
        html,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Resend error: ${err}`);
    }

    return NextResponse.json({ sent: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
