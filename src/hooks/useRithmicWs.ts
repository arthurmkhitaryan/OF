"use client";

import { useEffect, useRef, useState } from "react";
import type { LiveInstrument, TickPrint } from "@/lib/market-types";

export type WsStatus = "connecting" | "open" | "closed" | "error";

type TradeMsg = {
  type: "trade";
  symbol: string;
  time: number;
  time_ms: number;
  price: number;
  size: number;
  side: "BUY" | "SELL";
};

type SnapshotMsg = {
  type: "snapshot";
  symbol: string;
  prints: Array<{
    time: number;
    time_ms?: number;
    price: number;
    size: number;
    side: "BUY" | "SELL";
  }>;
};

type BboMsg = {
  type: "bbo";
  symbol: string;
  time_ms: number;
  mid: number;
  bid: number;
  ask: number;
};

type BarMsg = {
  type: "bar";
  symbol: string;
  bar: {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  };
};

function bridgeWsUrl(symbol: LiveInstrument): string {
  const explicit = process.env.NEXT_PUBLIC_RITHMIC_WS_URL;
  if (explicit) {
    const u = new URL(explicit);
    u.searchParams.set("symbol", symbol);
    return u.toString();
  }
  const http =
    process.env.NEXT_PUBLIC_RITHMIC_BRIDGE_URL ?? "http://127.0.0.1:7788";
  const base = http.replace(/^http/, "ws").replace(/\/$/, "");
  return `${base}/ws?symbol=${symbol}`;
}

function toPrint(p: {
  time: number;
  time_ms?: number;
  price: number;
  size: number;
  side: "BUY" | "SELL";
}): TickPrint {
  const time =
    p.time_ms != null ? p.time_ms / 1000 : Number(p.time);
  return {
    time,
    timeMs: p.time_ms ?? Math.round(time * 1000),
    price: p.price,
    size: p.size,
    side: p.side,
  };
}

/**
 * Direct WebSocket to Rithmic bridge — trades with millisecond timestamps.
 */
export function useRithmicWs(instrument: LiveInstrument) {
  const [status, setStatus] = useState<WsStatus>("connecting");
  const [prints, setPrints] = useState<TickPrint[]>([]);
  const [lastMs, setLastMs] = useState<number | null>(null);
  const [lastMid, setLastMid] = useState<number | null>(null);
  const [lastBar, setLastBar] = useState<BarMsg["bar"] | null>(null);
  const printsRef = useRef<TickPrint[]>([]);

  useEffect(() => {
    let stopped = false;
    let ws: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;

    const connect = () => {
      if (stopped) return;
      setStatus("connecting");
      const url = bridgeWsUrl(instrument);
      ws = new WebSocket(url);

      ws.onopen = () => {
        attempt = 0;
        setStatus("open");
        ws?.send(JSON.stringify({ op: "subscribe", symbol: instrument }));
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(String(ev.data)) as
            | TradeMsg
            | SnapshotMsg
            | BboMsg
            | BarMsg
            | { type: string };
          if (msg.type === "snapshot") {
            const snap = msg as SnapshotMsg;
            if (snap.symbol !== instrument) return;
            const next = (snap.prints ?? []).map(toPrint).slice(-2000);
            printsRef.current = next;
            setPrints(next);
            const last = next[next.length - 1];
            if (last) {
              if (last.timeMs) setLastMs(last.timeMs);
              setLastMid(last.price);
            }
            return;
          }
          if (msg.type === "trade") {
            const t = msg as TradeMsg;
            if (t.symbol !== instrument) return;
            const print = toPrint(t);
            const merged = [...printsRef.current, print].slice(-2000);
            printsRef.current = merged;
            setPrints(merged);
            setLastMs(t.time_ms);
            setLastMid(t.price);
            return;
          }
          if (msg.type === "bbo") {
            const b = msg as BboMsg;
            if (b.symbol !== instrument) return;
            setLastMs(b.time_ms);
            setLastMid(b.mid);
            return;
          }
          if (msg.type === "bar") {
            const b = msg as BarMsg;
            if (b.symbol !== instrument) return;
            setLastBar(b.bar);
          }
        } catch {
          /* ignore */
        }
      };

      ws.onerror = () => setStatus("error");
      ws.onclose = () => {
        setStatus("closed");
        if (stopped) return;
        attempt += 1;
        const delay = Math.min(8000, 500 * 2 ** Math.min(attempt, 4));
        retry = setTimeout(connect, delay);
      };
    };

    connect();
    return () => {
      stopped = true;
      if (retry) clearTimeout(retry);
      ws?.close();
      printsRef.current = [];
    };
  }, [instrument]);

  return { status, prints, lastMs, lastMid, lastBar };
}
