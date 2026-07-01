import { NextRequest, NextResponse } from "next/server";

const OPUS_API = "https://api.opus.pro/api";
const API_KEY = process.env.OPUS_API_KEY!;
const ORG_ID = process.env.OPUS_ORG_ID!;

/**
 * Opus Pro sends webhook notifications when a clip project completes.
 * Headers:
 *   X-Opus-Signature  — HMAC-SHA256(body + salt), keyed with your API secret
 *   X-Opus-Salt       — 8 random hex bytes, unique per request
 *   X-Opus-Timestamp  — Unix timestamp when the webhook was sent
 *
 * Payload (example):
 *   { projectId: "P000...", status: "DONE", stage: "DONE" }
 */
export async function POST(req: NextRequest) {
  try {
    // Read the raw body for signature verification
    const rawBody = await req.text();
    const signature = req.headers.get("x-opus-signature") || "";
    const salt = req.headers.get("x-opus-salt") || "";
    const timestamp = req.headers.get("x-opus-timestamp") || "";

    // Optional: verify the HMAC signature using Opus API secret key
    if (API_KEY && signature && salt) {
      const { createHmac, timingSafeEqual } = await import("node:crypto");
      const expectedSig = createHmac("sha256", API_KEY)
        .update(rawBody + salt)
        .digest("hex");

      // Constant-time comparison
      const bufExpected = Buffer.from(expectedSig, "hex");
      const bufActual = Buffer.from(signature, "hex");
      const valid =
        bufExpected.length === bufActual.length &&
        timingSafeEqual(bufExpected, bufActual);

      if (!valid) {
        console.error("[Opus Webhook] Invalid signature — rejecting");
        return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
      }

      // Optional: check timestamp freshness (reject if >5 min old)
      const now = Math.floor(Date.now() / 1000);
      const ts = parseInt(timestamp, 10);
      if (ts && now - ts > 300) {
        console.error("[Opus Webhook] Stale timestamp — rejecting");
        return NextResponse.json({ error: "Stale timestamp" }, { status: 403 });
      }
    }

    const body = JSON.parse(rawBody);
    const projectId = body.projectId || body.id;
    const status = body.status || body.stage || "";

    // Extract email from webhook URL query param
    const email = req.nextUrl.searchParams.get("email") || "";

    console.log(`[Opus Webhook] Received: projectId=${projectId}, status=${status}, email=${email ? email.slice(0, 30) + "..." : "none"}`);

    if (!projectId) {
      return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
    }

    // Only process completed projects
    const isDone = status === "DONE" || body.stage === "DONE";
    const isFailed = status === "FAILED" || body.stage === "FAILED";

    if (isFailed) {
      console.error(`[Opus Webhook] Project ${projectId} failed`);
      return NextResponse.json({ received: true, status: "failed" });
    }

    if (!isDone) {
      console.log(`[Opus Webhook] Project ${projectId} not yet done (${status}) — ignoring`);
      return NextResponse.json({ received: true, status: "not_ready" });
    }

    // --- Project is DONE — fetch clips and schedule them ---

    // Fetch clips from Opus
    const headers: Record<string, string> = {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    };
    if (ORG_ID) headers["x-opus-org-id"] = ORG_ID;

    const clipsRes = await fetch(
      `${OPUS_API}/exportable-clips?q=findByProjectId&projectId=${encodeURIComponent(projectId)}`,
      { headers }
    );

    if (!clipsRes.ok) {
      const errText = await clipsRes.text();
      throw new Error(`Failed to fetch clips: ${clipsRes.status} ${errText}`);
    }

    const rawClips: any[] = await clipsRes.json();
    console.log(`[Opus Webhook] Fetched ${rawClips.length} clips for project ${projectId}`);

    // ── Send email notification to the user ──
    if (email) {
      const { sendClipNotification } = await import("@/lib/email");
      const emailResult = await sendClipNotification({
        email,
        projectId,
        clips: rawClips.slice(0, 10),
        sourceUrl: body.sourceUri || body.url || "",
      });
      if (emailResult.ok) {
        console.log(`[Opus Webhook] Email notification sent to ${email}`);
      } else {
        console.error(`[Opus Webhook] Email notification failed: ${emailResult.error}`);
      }
    } else {
      console.log(`[Opus Webhook] No email provided — skipping notification`);
    }

    if (rawClips.length === 0) {
      return NextResponse.json({ received: true, clips: 0, message: "No clips found" });
    }

    // --- Get social accounts to find postAccountIds ---
    const accountsRes = await fetch(`${OPUS_API}/social-accounts?q=mine`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });

    const accountsJson = await accountsRes.json();
    const accounts: Array<{
      postAccountId: string;
      subAccountId?: string;
      platform: string;
    }> = accountsJson.data || [];
    // Also handle wrapped response format
    const accountsList = accounts.length > 0 ? accounts : (accountsJson.accounts || []);

    if (accountsList.length === 0) {
      console.log(`[Opus Webhook] No social accounts connected — clips ready for manual scheduling`);
      return NextResponse.json({
        received: true,
        clips: rawClips.length,
        message: "Clips ready. No social accounts to auto-schedule.",
      });
    }

    // --- Schedule each clip staggered by 6 hours starting from now ---
    const publishAt = new Date();
    publishAt.setMinutes(0, 0, 0); // Round to the hour
    if (publishAt < new Date()) publishAt.setHours(publishAt.getHours() + 1); // Next hour if past

    const scheduled: Array<{ clipId: string; channel: string; scheduleId: string }> = [];
    const errors: string[] = [];

    for (let i = 0; i < Math.min(rawClips.length, 10); i++) {
      const clip = rawClips[i];
      const clipStart = clip.id || clip.clipId;

      // Extract bare clipId from composite format "projectId.clipId"
      const parts = typeof clipStart === "string" ? clipStart.split(".") : [];
      const bareClipId = parts.length > 1 ? parts.slice(1).join(".") : clipStart;

      // Stagger by 6 hours per clip
      const clipTime = new Date(publishAt.getTime() + i * 6 * 60 * 60  * 1000);

      for (const account of accountsList) {
        const body: Record<string, unknown> = {
          projectId,
          clipId: bareClipId,
          postAccountId: account.postAccountId,
          postDetail: {
            title: clip.title || `Clip ${i + 1}`,
            mediaType: "video",
          },
          publishAt: clipTime.toISOString(),
        };

        if (account.subAccountId) {
          body.subAccountId = account.subAccountId;
        }

        try {
          const scheduleRes = await fetch(`${OPUS_API}/publish-schedules`, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
          });

          if (!scheduleRes.ok) {
            const errText = await scheduleRes.text();
            errors.push(
              `Failed to schedule clip ${bareClipId} on ${account.platform}: ${errText.slice(0, 200)}`
            );
            continue;
          }

          const scheduleData = await scheduleRes.json();
          scheduled.push({
            clipId: bareClipId,
            channel: account.platform,
            scheduleId: scheduleData?.data?.scheduleId || scheduleData?.scheduleId || "scheduled",
          });
        } catch (e: any) {
          errors.push(`Error scheduling ${bareClipId}: ${e.message}`);
        }
      }
    }

    console.log(`[Opus Webhook] Scheduled ${scheduled.length} posts for project ${projectId}`);

    return NextResponse.json({
      received: true,
      clips: rawClips.length,
      scheduled: scheduled.length,
      details: scheduled,
      errors: errors.length > 0 ? errors : undefined,
      message:
        scheduled.length > 0
          ? `${scheduled.length} posts scheduled via Opus Pro`
          : "Clips fetched but scheduling had issues",
    });
  } catch (err: any) {
    console.error("[Opus Webhook] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
