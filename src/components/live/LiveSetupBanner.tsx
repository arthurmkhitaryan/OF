"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function LiveSetupBanner({
  bridgeConnected,
  ofSource,
  priceSource,
  feedError,
}: {
  bridgeConnected: boolean;
  ofSource?: "bridge" | "demo" | "none";
  priceSource?: string;
  feedError?: string | null;
}) {
  const [bridge, setBridge] = useState<{
    reachable?: boolean;
    status?: string;
    connected?: boolean;
    error?: string;
    feed?: string;
    version?: string;
    bar_counts?: Record<string, number>;
    print_counts?: Record<string, number>;
  } | null>(null);

  useEffect(() => {
    void fetch("/api/market/bridge")
      .then((r) => r.json())
      .then(setBridge)
      .catch(() => setBridge({ reachable: false }));
  }, [bridgeConnected, ofSource, priceSource]);

  const live = bridgeConnected || bridge?.connected;
  const staleBridge =
    bridge?.reachable &&
    bridge?.connected &&
    bridge?.feed !== "rithmic_only" &&
    !bridge?.version?.startsWith("rithmic-only");

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-400">
      <p className="font-medium text-zinc-200">Live · Rithmic only</p>
      <p className="mt-1 text-xs leading-relaxed">
        Цена и Order Flow только из Rithmic bridge. Yahoo отключён.
      </p>

      {staleBridge && (
        <p className="mt-2 text-xs text-rose-300">
          Крутится <strong>старый</strong> bridge без `/bars`. В терминале
          bridge: Ctrl+C, затем снова{" "}
          <code className="text-zinc-200">npm run bridge</code>. В логе должно
          быть{" "}
          <code className="text-zinc-200">Rithmic-only: bars + Last Trades</code>
          .
        </p>
      )}

      {live && !staleBridge && priceSource === "bridge" && (
        <p className="mt-1 text-xs text-emerald-400">
          Feed: Rithmic · bars{" "}
          {bridge?.bar_counts
            ? JSON.stringify(bridge.bar_counts)
            : "…"}{" "}
          · prints{" "}
          {bridge?.print_counts
            ? JSON.stringify(bridge.print_counts)
            : "…"}
        </p>
      )}

      {!live && (
        <p className="mt-1 text-xs text-amber-300">
          Bridge offline — <code className="text-zinc-300">npm run bridge</code>
        </p>
      )}

      {feedError && !staleBridge && (
        <p className="mt-1 text-xs text-rose-300">{feedError}</p>
      )}

      <ul className="mt-2 space-y-1 text-xs text-zinc-500">
        <li>1. R | Trader → Rithmic Test → agreements</li>
        <li>
          2. <code className="text-zinc-400">npm run bridge</code>{" "}
          {live && !staleBridge ? (
            <span className="text-emerald-400">· live</span>
          ) : staleBridge ? (
            <span className="text-rose-400">· stale</span>
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
