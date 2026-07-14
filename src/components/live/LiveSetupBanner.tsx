"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function LiveSetupBanner({
  bridgeConnected,
  ofSource,
}: {
  bridgeConnected: boolean;
  ofSource?: "bridge" | "demo";
}) {
  const [bridge, setBridge] = useState<{ reachable?: boolean; status?: string } | null>(
    null
  );

  useEffect(() => {
    void fetch("/api/market/bridge")
      .then((r) => r.json())
      .then(setBridge)
      .catch(() => setBridge({ reachable: false }));
  }, []);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-400">
      <p className="font-medium text-zinc-200">Live Chart · Order Flow · Ticks</p>
      <p className="mt-1 text-xs leading-relaxed">
        Сейчас на графике: VP, GEX, Big trades / Absorption / Delta / Trapped, tick chart.
        {ofSource === "demo" && (
          <>
            {" "}
            <span className="text-amber-300">
              Tape = DEMO (восстановлен из 1m bars) — это не настоящий CME T&S.
            </span>{" "}
            Правильные print&apos;ы появятся после Rithmic Protocol + Lucid.
          </>
        )}
        {ofSource === "bridge" && (
          <span className="text-emerald-400"> OF идёт с Rithmic bridge — live tape.</span>
        )}
      </p>
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
          </a>{" "}
          → Protocol
        </li>
        <li>2. Lucid: custom app + Ticker/History Plant?</li>
        <li>
          3. Bridge:{" "}
          <code className="text-zinc-400">node tools/rithmic-bridge/server.mjs</code>{" "}
          {bridgeConnected || bridge?.reachable ? (
            <span className="text-emerald-400">· connected</span>
          ) : (
            <span className="text-zinc-600">· offline</span>
          )}
        </li>
        <li>
          Docs: <code className="text-zinc-400">docs/rithmic-setup.md</code> ·{" "}
          <Link href="/gex" className="text-sky-400 hover:underline">
            GEX
          </Link>
        </li>
      </ul>
    </div>
  );
}
