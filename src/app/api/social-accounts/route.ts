import { NextRequest, NextResponse } from "next/server";

const OPUS_API = "https://api.opus.pro/api";
const API_KEY = process.env.OPUS_API_KEY!;
const ORG_ID = process.env.OPUS_ORG_ID!;

interface OpusAccount {
  postAccountId: string;
  subAccountId?: string;
  platform: string;
  extUserId: string;
  extUserName: string;
  extUserPictureLink?: string;
  extUserProfileLink?: string;
}

export async function GET() {
  try {
    if (!API_KEY) {
      return NextResponse.json(
        { accounts: [], error: "OPUS_API_KEY not configured" }
      );
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${API_KEY}`,
    };
    if (ORG_ID) headers["x-opus-org-id"] = ORG_ID;

    const response = await fetch(
      `${OPUS_API}/social-accounts?q=mine`,
      { headers }
    );

    if (!response.ok) {
      return NextResponse.json({ accounts: [] });
    }

    const json = await response.json();
    const rawAccounts: OpusAccount[] = json.data || [];

    // Map Opus platform names to our simpler keys
    const platformMap: Record<string, string> = {
      YOUTUBE: "youtube",
      TIKTOK_BUSINESS: "tiktok",
      INSTAGRAM_BUSINESS: "instagram",
      FACEBOOK_PAGE: "facebook",
      LINKEDIN: "linkedin",
      TWITTER: "twitter",
    };

    const accounts = rawAccounts.map((a) => ({
      postAccountId: a.postAccountId,
      subAccountId: a.subAccountId,
      platform: platformMap[a.platform] || a.platform.toLowerCase(),
      platformOriginal: a.platform,
      username: a.extUserName,
      avatar: a.extUserPictureLink,
      profileUrl: a.extUserProfileLink,
    }));

    return NextResponse.json({ accounts });
  } catch (err: any) {
    console.error("Social accounts error:", err);
    return NextResponse.json({ accounts: [], error: err.message });
  }
}
