"use client";

import { useEffect, useState } from "react";

interface SocialAccount {
  postAccountId: string;
  platform: string;
  username: string;
  avatar?: string;
}

const CHANNEL_ICONS: Record<string, string> = {
  instagram: "📸",
  tiktok: "🎵",
  youtube: "▶️",
  facebook: "📘",
  linkedin: "💼",
  twitter: "🐦",
};

export default function DashboardPage() {
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/social-accounts")
      .then((r) => r.json())
      .then((data) => {
        setAccounts(data.accounts || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">📊 Posting Dashboard</h1>
            <p className="text-gray-400 mt-1 text-sm">
              Opus Pro handles scheduling &amp; posting — connect accounts to get started
            </p>
          </div>
          <a href="/" className="text-yellow-500 hover:text-yellow-400 text-sm">
            + New Video →
          </a>
        </div>

        {loading && (
          <div className="text-center py-16 text-gray-500">Loading...</div>
        )}

        {/* Connected accounts */}
        {!loading && (
          <div className="mb-8">
            <h2 className="text-xl font-bold mb-4 text-lg">🔗 Connected Social Accounts</h2>
            {accounts.length === 0 ? (
              <div className="border border-gray-800 rounded-xl p-8 text-center bg-gray-900/50">
                <p className="text-gray-400 mb-4 text-lg">
                  No social accounts connected
                </p>
                <a
                  href="https://clip.opus.pro/dashboard/settings/social-accounts"
                  target="_blank"
                  className="inline-block px-6 py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-lg transition text-lg"
                >
                  Connect in Opus Pro →
                </a>
              </div>
            ) : (
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
                {accounts.map((acc) => (
                  <div
                    key={acc.postAccountId}
                    className="border border-gray-800 rounded-xl p-4 bg-gray-900/50 flex items-center gap-3"
                  >
                    {acc.avatar ? (
                      <img
                        src={acc.avatar}
                        alt={acc.username}
                        className="w-10 h-10 rounded-full"
                      />
                    ) : (
                      <span className="text-2xl">
                        {CHANNEL_ICONS[acc.platform.toLowerCase()] || "🔗"}
                      </span>
                    )}
                    <div>
                      <p className="font-bold text-white">{acc.username}</p>
                      <p className="text-xs text-gray-500 capitalize">{acc.platform}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Guide */}
        <div className="border border-gray-800 rounded-xl p-6 bg-gray-900/50">
          <h2 className="text-lg font-bold mb-4">📋 How Scheduling Works</h2>
          <ol className="space-y-3 text-sm text-gray-400">
            <li className="flex gap-3">
              <span className="text-yellow-500 font-bold text-lg">1.</span>
              <span>
                <strong className="text-white text-lg">Paste a YouTube link</strong>{" "}
                on the home page
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-yellow-500 font-bold text-lg">2.</span>
              <span>
                <strong className="text-white text-lg">Opus Pro AI</strong>{" "}
                finds viral moments, renders clips with captions, B-roll, and music
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-yellow-500 font-bold text-lg">3.</span>
              <span>
                <strong className="text-white text-lg">Review &amp; schedule</strong>{" "}
                — pick clips, set frequency, choose channels
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-yellow-500 font-bold text-lg">4.</span>
              <span>
                <strong className="text-white text-lg">Opus Pro posts</strong>{" "}
                automatically to IG/TikTok/YouTube at the scheduled times — no cron needed
              </span>
            </li>
          </ol>
        </div>
      </div>
    </main>
  );
}
