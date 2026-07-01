import { NextRequest, NextResponse } from "next/server";

const GUILLERMO_EMAIL = process.env.GUILLERMO_EMAIL || "guillermo@example.com";

export async function POST(req: NextRequest) {
  try {
    const { projectId, clips, url } = await req.json();

    const { sendClipNotification } = await import("@/lib/email");

    const result = await sendClipNotification({
      email: GUILLERMO_EMAIL,
      projectId,
      clips,
      sourceUrl: url,
    });

    if (!result.ok) {
      throw new Error(result.error);
    }

    return NextResponse.json({ sent: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
