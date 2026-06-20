"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface Clip {
  clipId: string;
  projectId: string;
  title: string;
  duration: number;
  durationMs: number;
  previewUrl: string;
  exportUrl: string;
  start: number;
  end: number;
  keywords: string[];
  transcript: string;
  hook: string;
  type: string;
  score: number;
}

interface JobMeta {
  projectId: string;
  url: string;
  status: string;
  stage?: string;
}

interface SocialAccount {
  postAccountId: string;
  subAccountId?: string;
  platform: string;
  username: string;
  avatar?: string;
}

const FREQUENCIES = [
  { label: "Every 6 hours", value: "6h" },
  { label: "Every 12 hours", value: "12h" },
  { label: "Every 24 hours", value: "24h" },
  { label: "Every 48 hours", value: "48h" },
];

const CHANNEL_ICONS: Record<string, string> = {
  instagram: "📸",
  tiktok: "🎵",
  youtube: "▶️",
  facebook: "📘",
  linkedin: "💼",
  twitter: "🐦",
};

export default function ClipsPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [meta, setMeta] = useState<JobMeta | null>(null);
  const [clips, setClips] = useState<Clip[]>([]);
  const [selectedClips, setSelectedClips] = useState<Set<number>>(new Set());
  const [frequency, setFrequency] = useState("12h");
  const [channels, setChannels] = useState<Set<string>>(
    new Set(["instagram", "tiktok"])
  );
  const [startTime, setStartTime] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [sentEmail, setSentEmail] = useState(false);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [scheduleError, setScheduleError] = useState("");

  // Fetch social accounts from Opus
  useEffect(() => {
    fetch("/api/social-accounts")
      .then((r) => r.json())
      .then((data) => {
        if (data.accounts?.length) {
          setAccounts(data.accounts);
          // Auto-select available channels
          const availableChannels = new Set(
            data.accounts.map((a: SocialAccount) => a.platform)
          );
          setChannels(availableChannels);
        }
      })
      .catch(console.error);
  }, []);

  // Poll for clips
  useEffect(() => {
    const poll = async () => {
      try {
        const [metaRes, clipsRes] = await Promise.all([
          fetch(`/api/job/${projectId}`),
          fetch(`/api/clips/${projectId}`),
        ]);
        const metaData = await metaRes.json();
        const clipsData = await clipsRes.json();

        setMeta(metaData);
        if (clipsData.clips?.length) {
          setClips(clipsData.clips);
          setSelectedClips(
            new Set(clipsData.clips.map((_: any, i: number) => i))
          );
        }

        if (metaData.status === "done" || metaData.status === "failed") {
          setLoading(false);
        }
      } catch (err) {
        console.error(err);
      }
    };

    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [projectId]);

  const toggleClip = (idx: number) => {
    const next = new Set(selectedClips);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setSelectedClips(next);
  };

  const toggleChannel = (id: string) => {
    const next = new Set(channels);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setChannels(next);
  };

  const handleSchedule = async () => {
    if (selectedClips.size === 0) return;
    setSaving(true);
    setScheduleError("");

    const selected = Array.from(selectedClips).map((i) => clips[i]);

    try {
      const res = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          clips: selected.map((c) => ({
            clipId: c.clipId,
            title: c.title || c.hook,
            duration: c.duration,
          })),
          frequency,
          channels: Array.from(channels),
          startTime: startTime || new Date().toISOString(),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSaved(true);
      } else {
        setScheduleError(data.error || "Schedule failed");
      }
    } catch (err: any) {
      setScheduleError(err.message);
    }
    setSaving(false);
  };

  const handleSendEmail = async () => {
    setSaving(true);
    try {
      await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          clips,
          url: meta?.url,
        }),
      });
      setSentEmail(true);
    } catch (err) {
      console.error(err);
    }
    setSaving(false);
  };

  const formatTime = (s: number) => {
    const min = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${min}:${sec.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center max-w-md">
          <svg
            className="animate-spin h-10 w-10 text-yellow-500 mx-auto mb-4"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <p className="text-gray-400 text-lg">
            {meta?.stage
              ? `Opus Pro: ${meta.stage.toLowerCase()}...`
              : "Opus Pro is analyzing your video..."}
          </p>
          <p className="text-gray-600 text-sm mt-2">
            AI is finding the best viral moments — this usually takes 2-5 minutes
          </p>
        </div>
      </main>
    );
  }

  if (meta?.status === "failed") {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center max-w-md">
          <p className="text-red-400 text-xl mb-4">❌ Processing Failed</p>
          <p className="text-gray-400">{meta?.error || "Opus Pro could not process this video"}</p>
          <a
            href="/"
            className="inline-block mt-6 text-yellow-500 hover:text-yellow-400"
          >
            ← Try another video
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">🎬 Your Viral Clips</h1>
            <p className="text-gray-400 mt-1 text-sm">
              {clips.length} clips found · powered by Opus Pro
            </p>
          </div>
          <a
            href="/dashboard"
            className="text-yellow-500 hover:text-yellow-400 text-sm"
          >
            View schedules →
          </a>
        </div>

        {/* Clips list */}
        <div className="space-y-4 mb-10">
          {clips.map((clip, idx) => {
            const isSelected = selectedClips.has(idx);
            return (
              <div
                key={clip.clipId}
                onClick={() => toggleClip(idx)}
                className={`border-[3px] rounded-xl cursor-pointer transition-all ${
                  isSelected
                    ? "border-yellow-500 bg-yellow-500/5"
                    : "border-gray-800 hover:border-gray-600 bg-gray-900/50"
                }`}
              >
                <div className="flex flex-col md:flex-row gap-4 p-5">
                  {/* Preview thumbnail */}
                  {clip.previewUrl && (
                    <div className="flex-shrink-0">
                      <video
                        src={clip.previewUrl}
                        className="w-full md:w-40 h-auto rounded-lg bg-gray-800"
                        muted
                        preload="metadata"
                        onMouseEnter={(e) => (e.currentTarget as HTMLVideoElement).play()}
                        onMouseLeave={(e) => {
                          const v = e.currentTarget as HTMLVideoElement;
                          v.pause();
                          v.currentTime = 0;
                        }}
                      />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xs font-mono text-gray-500 bg-gray-800 px-2 py-1 rounded">
                        {clip.duration}s
                      </span>
                      {clip.keywords?.map((kw) => (
                        <span
                          key={kw}
                          className="text-xs px-2 py-1 rounded bg-yellow-500/10 text-yellow-500"
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                    <p className="text-sm font-bold text-white mb-1 line-clamp-2">
                      🪝 {clip.title || clip.hook}
                    </p>
                    {clip.transcript && (
                      <p className="text-xs text-gray-400 line-clamp-2">
                        {clip.transcript.slice(0, 200)}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleClip(idx)}
                      className="w-5 h-5 accent-yellow-500"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {clips.length === 0 && (
          <div className="text-center py-16 text-gray-500">
            No clips found. Opus Pro may still be processing — refresh in a moment.
          </div>
        )}

        {/* Scheduling panel */}
        {clips.length > 0 && (
          <div className="border border-gray-800 rounded-xl p-6 bg-gray-900/50">
            <h2 className="text-xl font-bold mb-6">
              ⚙️ Schedule Posts via Opus Pro
            </h2>

            {/* Frequency */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Posting Frequency
              </label>
              <div className="flex gap-2 flex-wrap">
                {FREQUENCIES.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setFrequency(f.value)}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition ${
                      frequency === f.value
                        ? "bg-yellow-500 text-black"
                        : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Channels */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Post to Channels
              </label>
              {accounts.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No social accounts connected in Opus Pro.{" "}
                  <a
                    href="https://clip.opus.pro/dashboard/settings/social-accounts"
                    target="_blank"
                    className="text-yellow-500 hover:text-yellow-400 underline"
                  >
                    Connect them here →
                  </a>
                </p>
              ) : (
                <div className="flex gap-3 flex-wrap">
                  {accounts.map((acc) => (
                    <button
                      key={acc.platform}
                      onClick={() => toggleChannel(acc.platform)}
                      className={`px-5 py-3 rounded-lg text-sm font-bold transition flex items-center gap-2 ${
                        channels.has(acc.platform)
                          ? "bg-yellow-500 text-black"
                          : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                      }`}
                    >
                      <span>{CHANNEL_ICONS[acc.platform] || "🔗"}</span>
                      {acc.username || acc.platform}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Start time */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                First Post At
              </label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full max-w-xs px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-yellow-500"
              />
              {!startTime && (
                <p className="text-xs text-gray-500 mt-1">
                  Leave empty to start immediately
                </p>
              )}
            </div>

            {/* Summary */}
            <div className="bg-gray-800/50 rounded-lg p-4 mb-6 text-sm text-gray-400">
              <p>
                <span className="text-white font-bold text-lg">
                  {selectedClips.size}
                </span>{" "}
                clip{selectedClips.size !== 1 ? "s" : ""} selected · posting{" "}
                <span className="text-white font-bold">{frequency}</span> to{" "}
                <span className="text-white font-bold">
                  {Array.from(channels)
                    .map((c) => CHANNEL_ICONS[c] + " " + c)
                    .join(" & ")}
                </span>
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Opus Pro will handle rendering, captions, and posting automatically
              </p>
            </div>

            {scheduleError && (
              <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg text-sm mb-4">
                {scheduleError}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={handleSchedule}
                disabled={
                  saving ||
                  selectedClips.size === 0 ||
                  channels.size === 0 ||
                  accounts.length === 0 ||
                  saved
                }
                className="px-6 py-3 bg-yellow-500 hover:bg-yellow-400 disabled:bg-gray-700 disabled:text-gray-500 text-black font-bold rounded-lg transition text-lg"
              >
                {saved
                  ? "✅ Scheduled on Opus Pro!"
                  : saving
                  ? "Scheduling..."
                  : "🚀 Schedule & Post via Opus Pro"}
              </button>

              <button
                onClick={handleSendEmail}
                disabled={saving || sentEmail}
                className="px-6 py-3 bg-gray-800 hover:bg-gray-700 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold rounded-lg transition border border-gray-700"
              >
                {sentEmail ? "📧 Sent!" : "📧 Email to Guillermo"}
              </button>
            </div>

            {saved && (
              <div className="mt-6 bg-green-900/30 border border-green-700 rounded-lg p-4 text-green-300 text-sm">
                🎉 Posts are scheduled with Opus Pro! First clip goes out{" "}
                {startTime
                  ? new Date(startTime).toLocaleString()
                  : "soon"}. Opus handles rendering + posting automatically.
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
