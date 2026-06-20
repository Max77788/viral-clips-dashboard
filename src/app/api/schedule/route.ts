import { NextRequest, NextResponse } from "next/server";

const OPUS_API = "https://api.opus.pro/api";
const API_KEY = process.env.OPUS_API_KEY!;
const ORG_ID = process.env.OPUS_ORG_ID!;

// Map our channel names to Opus platform names
const PLATFORM_TO_OPUS: Record<string, string> = {
  instagram: "INSTAGRAM_BUSINESS",
  tiktok: "TIKTOK_BUSINESS",
  youtube: "YOUTUBE",
  facebook: "FACEBOOK_PAGE",
  linkedin: "LINKEDIN",
  twitter: "TWITTER",
};

// Types for schedule request
interface ScheduleClip {
  clipId: string;
  title: string;
  duration: number;
}

interface ScheduleRequest {
  projectId: string;
  clips: ScheduleClip[];
  frequency: string;
  channels: string[];
  startTime: string;
}

export async function POST(req: NextRequest) {
  try {
    const { projectId, clips, frequency, channels, startTime } =
      (await req.json()) as ScheduleRequest;

    if (!projectId || !clips?.length || !channels?.length) {
      return NextResponse.json(
        { error: "projectId, clips, and channels are required" },
        { status: 400 }
      );
    }

    if (!API_KEY) {
      return NextResponse.json(
        { error: "OPUS_API_KEY not configured" },
        { status: 500 }
      );
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    };
    if (ORG_ID) headers["x-opus-org-id"] = ORG_ID;

    // Step 1: Get connected social accounts to find postAccountId/subAccountId
    const accountsRes = await fetch(
      `${OPUS_API}/social-accounts?q=mine`,
      { headers: { Authorization: `Bearer ${API_KEY}` } }
    );

    if (!accountsRes.ok) {
      throw new Error(
        `Failed to fetch social accounts (${accountsRes.status}) - connect IG/TikTok in Opus Pro first`
      );
    }

    const accountsJson = await accountsRes.json();
    const accounts: Array<{
      postAccountId: string;
      subAccountId?: string;
      platform: string;
    }> = accountsJson.data || [];

    // Map channels to Opus account IDs
    const freqHours: Record<string, number> = {
      "6h": 6,
      "12h": 12,
      "24h": 24,
      "48h": 48,
    };
    const intervalHours = freqHours[frequency] || 24;
    let publishAt = new Date(startTime || Date.now());

    const scheduled: Array<{ clipId: string; channel: string; scheduleId: string }> = [];
    const errors: string[] = [];

    // Schedule each clip, staggered by frequency, for each channel
    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];

      // Calculate publish time for this clip
      const clipPublishTime = new Date(publishAt.getTime() + i * intervalHours * 3600 * 1000);

      for (const channel of channels) {
        const opusPlatform = PLATFORM_TO_OPUS[channel] || channel.toUpperCase();
        const account = accounts.find((a) => a.platform === opusPlatform);

        if (!account) {
          errors.push(
            `No connected ${channel} account found in Opus Pro - connect it first`
          );
          continue;
        }

        const body: Record<string, unknown> = {
          projectId,
          clipId: clip.clipId,
          postAccountId: account.postAccountId,
          postDetail: {
            title: clip.title || `Clip ${i + 1}`,
            mediaType: "video",
          },
          publishAt: clipPublishTime.toISOString(),
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
              `Failed to schedule ${clip.clipId} on ${channel}: ${scheduleRes.status} ${errText.slice(0, 200)}`
            );
            continue;
          }

          const scheduleData = await scheduleRes.json();
          scheduled.push({
            clipId: clip.clipId,
            channel,
            scheduleId: scheduleData.id || scheduleData.scheduleId || "scheduled",
          });
        } catch (e: any) {
          errors.push(`Error scheduling ${clip.clipId} on ${channel}: ${e.message}`);
        }
      }
    }

    return NextResponse.json({
      scheduled: scheduled.length,
      total: clips.length * channels.length,
      details: scheduled,
      errors: errors.length > 0 ? errors : undefined,
      message:
        scheduled.length > 0
          ? `${scheduled.length} posts scheduled via Opus Pro`
          : "No posts were scheduled",
    });
  } catch (err: any) {
    console.error("Schedule error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
