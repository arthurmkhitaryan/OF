"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function LiveSetupBanner({
  bridgeConnected,
  ofSource,
}: {
  bridgeConnected: boolean;
  ofSource?: "bridge" | "demo" | "none";
}) {
  const [bridge, setBridge] = useState<{
    reachable?: boolean;
    status?: string;
    connected?: boolean;
    error?: string;
  } | null>(null);

  useEffect(() => {
    void fetch("/api/market/bridge")
      .then((r) => r.json())
      .then(setBridge)
      .catch(() => setBridge({ reachable: false }));
  }, [bridgeConnected, ofSource]);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-400">
      <p className="font-medium text-zinc-200">Live · Real Order Flow</p>
      <p className="mt-1 text-xs leading-relaxed">
        Delta / Big / Absorption / Trapped считаются только из{" "}
        <strong className="text-zinc-300">реальных Last Trades</strong> (Rithmic
        Ticker Plant через bridge). DEMO по умолчанию выключен.
      </p>
      {ofSource === "bridge" && (
        <p className="mt-1 text-xs text-emerald-400">
          OF: bridge — live tape подключён.
        </p>
      )}
      {ofSource === "none" && (
        <p className="mt-1 text-xs text-amber-300">
          OF пустой — запусти bridge с Lucid/Rithmic credentials (см. ниже).
        </p>
      )}
      {ofSource === "demo" && (
        <p className="mt-1 text-xs text-amber-300">
          OF: DEMO (ALLOW_DEMO_OF=1). Это не CME tape.
        </p>
      )}
      <ul className="mt-2 space-y-1 text-xs text-zinc-500">
        <li>
          1. Dev Kit:{" "}
          <a
            href="https://www.rithmic.com/apis"
            target="_blank"
            rel="noreferrer"
            className="text-sky-400 hover:underline"
          >
            rithmic.com/apis
          </a>
        </li>
        <li>2. Lucid: custom app + Ticker Plant login?</li>
        <li>
          3. Bridge:{" "}
          <code className="text-zinc-400">
            py -3.12 tools/rithmic-bridge/server.py
          </code>{" "}
          {bridgeConnected || bridge?.connected ? (
            <span className="text-emerald-400">· live</span>
          ) : bridge?.reachable ? (
            <span className="text-amber-400">· up, waiting tape</span>
          ) : (
            <span className="text-zinc-600">· offline</span>
          )}
        </li>
        <li>
          Docs:{" "}
          <code className="text-zinc-400">tools/rithmic-bridge/README.md</code> ·{" "}
          <Link href="/gex" className="text-sky-400 hover:underline">
            GEX
          </Link>
        </li>
      </ul>
    </div>
  );
}
