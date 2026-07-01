"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const [url, setUrl] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !email.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), email: email.trim() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Processing failed");

      // Navigate to clips page with projectId
      router.push(`/clips/${data.projectId}`);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6">
      <div className="max-w-xl w-full">
        <h1 className="text-4xl font-bold text-center mb-2">
          🎬 Viral Clip Machine
        </h1>
        <p className="text-gray-400 text-center mb-10 text-sm">
          Drop a YouTube link → Opus Pro AI extracts the best clips → you pick &amp; schedule
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Your Email <span className="text-yellow-500">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="guillermo@example.com"
              className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition"
              disabled={loading}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              YouTube Video URL
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition"
              disabled={loading}
            />
          </div>

          {error && (
            <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !url.trim() || !email.trim()}
            className="w-full py-3 px-6 bg-yellow-500 hover:bg-yellow-400 disabled:bg-gray-700 disabled:text-gray-500 text-black font-bold rounded-lg transition text-lg"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Sending to Opus Pro...
              </span>
            ) : (
              "Extract Viral Clips"
            )}
          </button>
        </form>

        <div className="mt-12 border-t border-gray-800 pt-8">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
            How it works
          </h2>
          <ol className="space-y-3 text-sm text-gray-500">
            <li className="flex gap-3">
              <span className="text-yellow-500 font-bold">1.</span>
              Paste any YouTube link — podcast, interview, talk, vlog
            </li>
            <li className="flex gap-3">
              <span className="text-yellow-500 font-bold">2.</span>
              Opus Pro AI finds viral moments, renders clips with captions
            </li>
            <li className="flex gap-3">
              <span className="text-yellow-500 font-bold">3.</span>
              Clips are emailed to Guillermo for review
            </li>
            <li className="flex gap-3">
              <span className="text-yellow-500 font-bold">4.</span>
              Pick clips, set posting frequency + channels, Opus posts automatically
            </li>
          </ol>
        </div>
      </div>
    </main>
  );
}
