"""
Rithmic → HTTP bridge for myapp Live chart + Order Flow.

All market data (1m bars + Last Trades) comes from Rithmic only.
No Yahoo / demo feed.

Requires:
  - Rithmic Protocol Dev Kit credentials (Test or Lucid)
  - Python 3.11–3.13 venv (see README)

Env (see .env.example):
  RITHMIC_USER, RITHMIC_PASSWORD, RITHMIC_SYSTEM, RITHMIC_URL
  RITHMIC_APP_NAME, RITHMIC_BRIDGE_PORT, RITHMIC_SSL_VERIFY
"""

from __future__ import annotations

import asyncio
import json
import os
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Deque, Dict, List, Optional, Set

from aiohttp import WSMsgType, web

try:
    from dotenv import load_dotenv

    _here = Path(__file__).resolve().parent
    load_dotenv(_here / ".env")
    load_dotenv(_here.parent.parent / ".env")
except ImportError:
    pass

PORT = int(os.getenv("RITHMIC_BRIDGE_PORT", "7788"))
MAX_PRINTS = 4000
MAX_BARS = 500
EXCHANGE = "CME"
HISTORY_HOURS = int(os.getenv("RITHMIC_HISTORY_HOURS", "18"))
TICK_HISTORY_HOURS = float(os.getenv("RITHMIC_TICK_HOURS", "3"))
BRIDGE_VERSION = "rithmic-only-5"
OUTLIER_PTS = {"NQ": 350.0, "ES": 40.0}

# WebSocket subscribers: {ws → set of roots}
ws_clients: Dict[web.WebSocketResponse, Set[str]] = {}

CONTRACTS: Dict[str, str] = {}
prints_by_root: Dict[str, Deque[dict]] = defaultdict(lambda: deque(maxlen=MAX_PRINTS))
bars_by_root: Dict[str, List[dict]] = defaultdict(list)
client_ref: Dict[str, Any] = {"client": None}

state: Dict[str, Any] = {
    "status": "starting",
    "connected": False,
    "error": None,
    "symbols": {},
    "last_tick_at": None,
    "bars_loaded": {},
    "prints_loaded": {},
    "live_trades": 0,
    "live_bbo": 0,
}


def env(name: str, default: str = "") -> str:
    return (os.getenv(name) or default).strip()


def root_of(symbol: str) -> str:
    s = (symbol or "").upper()
    if s.startswith("NQ"):
        return "NQ"
    if s.startswith("ES"):
        return "ES"
    return s[:2] if s else ""


def exchange_time_sec(data: dict) -> float:
    """Exchange/source timestamp with microsecond precision → unix seconds (float)."""
    src = data.get("source_ssboe")
    if src is not None:
        usecs = float(data.get("source_usecs") or 0)
        nsecs = float(data.get("source_nsecs") or 0)
        return float(src) + usecs / 1_000_000.0 + nsecs / 1_000_000_000.0
    ssboe = data.get("ssboe")
    if ssboe is not None:
        usecs = float(data.get("usecs") or 0)
        return float(ssboe) + usecs / 1_000_000.0
    dt = data.get("datetime")
    if dt is not None and hasattr(dt, "timestamp"):
        return float(dt.timestamp())
    return time.time()


def tick_to_print(data: dict) -> Optional[dict]:
    """Map async_rithmic on_tick LastTrade dict → TickPrint JSON (ms precision)."""
    if data.get("data_type") is not None:
        dt = data["data_type"]
        try:
            val = int(dt)
        except Exception:
            val = getattr(dt, "value", None)
        if val is not None and val != 1:
            return None

    price = data.get("trade_price") or data.get("price")
    size = data.get("trade_size") or data.get("size") or data.get("volume")
    if price is None:
        return None
    try:
        size_i = int(size) if size is not None else 1
    except (TypeError, ValueError):
        size_i = 1
    if size_i <= 0:
        size_i = 1

    raw_agg = data.get("aggressor")
    if raw_agg is None:
        raw_agg = data.get("aggressor_side") or data.get("transaction_type")
    try:
        agg_num = int(raw_agg)
    except (TypeError, ValueError):
        agg_num = None
        agg = str(raw_agg or "").upper()
    else:
        agg = ""
    if agg_num == 1 or "BUY" in agg or agg in ("B", "BID"):
        side = "BUY"
    elif agg_num == 2 or "SELL" in agg or agg in ("S", "ASK"):
        side = "SELL"
    else:
        side = "BUY"

    t = exchange_time_sec(data)
    time_ms = int(round(t * 1000.0))

    return {
        "time": t,
        "time_ms": time_ms,
        "price": float(price),
        "size": size_i,
        "side": side,
        "symbol": data.get("symbol") or data.get("trading_symbol"),
        "ssboe": data.get("source_ssboe") or data.get("ssboe"),
        "usecs": data.get("source_usecs") or data.get("usecs") or 0,
    }


async def ws_broadcast(msg: dict, roots: Optional[Set[str]] = None) -> None:
    """Push JSON to subscribed websocket clients (millisecond tape)."""
    if not ws_clients:
        return
    payload = json.dumps(msg, separators=(",", ":"))
    dead: List[web.WebSocketResponse] = []
    for ws, sub in list(ws_clients.items()):
        if roots is not None and sub and sub.isdisjoint(roots):
            continue
        try:
            await ws.send_str(payload)
        except Exception:
            dead.append(ws)
    for ws in dead:
        ws_clients.pop(ws, None)


def rithmic_bar_to_json(data: dict) -> Optional[dict]:
    """History / live time bar → OHLC + bid/ask volume for delta."""
    marker = data.get("marker")
    o = data.get("open_price")
    h = data.get("high_price")
    l = data.get("low_price")
    c = data.get("close_price")
    if marker is None or o is None or h is None or l is None or c is None:
        return None
    vol = data.get("volume") or data.get("num_trades") or 0
    bid_v = int(data.get("bid_volume") or 0)
    ask_v = int(data.get("ask_volume") or 0)
    return {
        "time": int(marker),
        "open": float(o),
        "high": float(h),
        "low": float(l),
        "close": float(c),
        "volume": int(vol),
        "bid_volume": bid_v,
        "ask_volume": ask_v,
    }


def filter_outlier_bars(root: str, bars: List[dict]) -> List[dict]:
    if len(bars) < 20:
        return bars
    closes = sorted(b["close"] for b in bars)
    med = closes[len(closes) // 2]
    lim = OUTLIER_PTS.get(root, 200.0)
    cleaned = [
        b
        for b in bars
        if abs(b["close"] - med) <= lim
        and abs(b["high"] - med) <= lim
        and abs(b["low"] - med) <= lim
    ]
    dropped = len(bars) - len(cleaned)
    if dropped:
        print(f"[bridge] filtered {dropped} outlier bars for {root} (median={med})")
    return cleaned if len(cleaned) >= 20 else bars


def prints_from_bar_delta(root: str, bars: List[dict]) -> List[dict]:
    """Fallback OF tape from 1m bid_volume / ask_volume (Rithmic time bars)."""
    out: List[dict] = []
    contract = CONTRACTS.get(root, root)
    for b in bars:
        t = float(b["time"]) + 30.0
        px = float(b["close"])
        ask_v = int(b.get("ask_volume") or 0)
        bid_v = int(b.get("bid_volume") or 0)
        if ask_v > 0:
            out.append(
                {
                    "time": t,
                    "price": px,
                    "size": ask_v,
                    "side": "BUY",
                    "symbol": contract,
                    "origin": "bar_delta",
                }
            )
        if bid_v > 0:
            out.append(
                {
                    "time": t + 0.001,
                    "price": px,
                    "size": bid_v,
                    "side": "SELL",
                    "symbol": contract,
                    "origin": "bar_delta",
                }
            )
    return out[-MAX_PRINTS:]


def tick_bar_to_prints(data: dict, contract: str) -> List[dict]:
    """Historical 1-tick bars → BUY/SELL prints via ask/bid volume."""
    dt = data.get("datetime")
    if dt is not None and hasattr(dt, "timestamp"):
        t = float(dt.timestamp())
    else:
        ssboe_list = data.get("data_bar_ssboe") or []
        usecs_list = data.get("data_bar_usecs") or [0]
        if ssboe_list:
            t = float(ssboe_list[0]) + float(usecs_list[0] if usecs_list else 0) / 1e6
        else:
            return []

    close = data.get("close_price") or data.get("open_price")
    if close is None:
        return []
    ask_v = int(data.get("ask_volume") or 0)
    bid_v = int(data.get("bid_volume") or 0)
    vol = int(data.get("volume") or 0)
    out: List[dict] = []
    px = float(close)
    if ask_v > 0:
        out.append(
            {
                "time": t,
                "price": px,
                "size": ask_v,
                "side": "BUY",
                "symbol": contract,
                "origin": "tick_bar",
            }
        )
    if bid_v > 0:
        out.append(
            {
                "time": t + 0.0001,
                "price": px,
                "size": bid_v,
                "side": "SELL",
                "symbol": contract,
                "origin": "tick_bar",
            }
        )
    if not out and vol > 0:
        out.append(
            {
                "time": t,
                "price": px,
                "size": vol,
                "side": "BUY",
                "symbol": contract,
                "origin": "tick_bar",
            }
        )
    return out


def upsert_bar(root: str, bar: dict) -> None:
    bars = bars_by_root[root]
    if bars and bars[-1]["time"] == bar["time"]:
        bars[-1] = bar
    elif bars and bars[-1]["time"] > bar["time"]:
        # insert ordered
        i = len(bars) - 1
        while i >= 0 and bars[i]["time"] > bar["time"]:
            i -= 1
        if i >= 0 and bars[i]["time"] == bar["time"]:
            bars[i] = bar
        else:
            bars.insert(i + 1, bar)
    else:
        bars.append(bar)
    if len(bars) > MAX_BARS:
        del bars[: len(bars) - MAX_BARS]


def apply_print_to_bars(root: str, pr: dict) -> None:
    """Keep forming last 1m candle from live Last Trades."""
    bars = bars_by_root[root]
    close = float(pr["price"])
    size = int(pr["size"])
    now = int(pr["time"])
    minute = now - (now % 60)

    if not bars:
        bars_by_root[root] = [
            {
                "time": minute,
                "open": close,
                "high": close,
                "low": close,
                "close": close,
                "volume": size,
            }
        ]
        return

    last = bars[-1]
    if minute > last["time"]:
        bars.append(
            {
                "time": minute,
                "open": last["close"],
                "high": max(last["close"], close),
                "low": min(last["close"], close),
                "close": close,
                "volume": size,
            }
        )
        if len(bars) > MAX_BARS:
            del bars[0]
    else:
        last["high"] = max(last["high"], close)
        last["low"] = min(last["low"], close)
        last["close"] = close
        last["volume"] = int(last.get("volume") or 0) + size


def apply_quote_to_bars(root: str, mid: float) -> None:
    """Update last close from BBO mid when tape is quiet."""
    bars = bars_by_root.get(root) or []
    if not bars or mid <= 0:
        return
    last = bars[-1]
    last["high"] = max(last["high"], mid)
    last["low"] = min(last["low"], mid)
    last["close"] = mid


def fallback_front_month(root: str) -> str:
    """Quarterly CME codes (H M U Z) when get_front_month_contract is empty."""
    now = datetime.now(timezone.utc)
    y = now.year % 10
    m = now.month
    # next quarterly month code
    if m <= 3:
        code = "H"
    elif m <= 6:
        code = "M"
    elif m <= 9:
        code = "U"
    else:
        code = "Z"
    return f"{root}{code}{y}"


def make_ssl_context():
    verify = env("RITHMIC_SSL_VERIFY", "1").lower() not in ("0", "false", "no")
    if verify:
        from async_rithmic.client import _setup_ssl_context

        return _setup_ssl_context()
    import ssl

    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx


async def load_history(client: Any, root: str, contract: str) -> None:
    from async_rithmic import TimeBarType

    end = datetime.now(timezone.utc)
    start = end - timedelta(hours=HISTORY_HOURS)
    print(f"[bridge] loading {HISTORY_HOURS}h 1m bars {root} → {contract}")
    try:
        raw = await client.get_historical_time_bars(
            contract,
            EXCHANGE,
            start,
            end,
            TimeBarType.MINUTE_BAR,
            1,
            wait=True,
            idle_timeout=20.0,
        )
    except Exception as e:
        print(f"[bridge] history {root} failed: {e}")
        state["error"] = f"history {root}: {e}"
        return

    bars: List[dict] = []
    for d in raw or []:
        b = rithmic_bar_to_json(d)
        if b:
            bars.append(b)
    bars.sort(key=lambda x: x["time"])
    dedup: List[dict] = []
    for b in bars:
        if dedup and dedup[-1]["time"] == b["time"]:
            dedup[-1] = b
        else:
            dedup.append(b)
    dedup = filter_outlier_bars(root, dedup)
    bars_by_root[root] = dedup[-MAX_BARS:]
    state["bars_loaded"][root] = len(bars_by_root[root])
    print(f"[bridge] history {root}: {len(bars_by_root[root])} bars")


async def load_tick_history(client: Any, root: str, contract: str) -> None:
    """Load recent tick bars → seed Order Flow prints."""
    end = datetime.now(timezone.utc)
    start = end - timedelta(hours=TICK_HISTORY_HOURS)
    print(f"[bridge] loading {TICK_HISTORY_HOURS}h tick bars {root} → {contract}")
    try:
        raw = await client.get_historical_tick_data(
            contract,
            EXCHANGE,
            start,
            end,
            wait=True,
            idle_timeout=25.0,
            max_pages=50,
        )
    except Exception as e:
        print(f"[bridge] tick history {root} failed: {e}")
        # fallback from 1m bid/ask volumes
        fb = prints_from_bar_delta(root, bars_by_root.get(root, []))
        if fb:
            prints_by_root[root].clear()
            prints_by_root[root].extend(fb)
            state["prints_loaded"][root] = len(fb)
            print(f"[bridge] OF fallback from bar Δ {root}: {len(fb)} prints")
        return

    collected: List[dict] = []
    for d in raw or []:
        collected.extend(tick_bar_to_prints(d, contract))
    collected.sort(key=lambda p: p["time"])
    if not collected:
        collected = prints_from_bar_delta(root, bars_by_root.get(root, []))
        origin = "bar_delta"
    else:
        origin = "tick_bar"

    prints_by_root[root].clear()
    prints_by_root[root].extend(collected[-MAX_PRINTS:])
    state["prints_loaded"][root] = len(prints_by_root[root])
    print(f"[bridge] OF {root}: {len(prints_by_root[root])} prints ({origin})")


async def poll_new_ticks(client: Any, root: str, contract: str) -> int:
    """
    Poll recent tick-bar history and push NEW prints over WS.
    Used when live LAST_TRADE stream is silent (common on Rithmic Test).
    """
    end = datetime.now(timezone.utc)
    start = end - timedelta(minutes=3)
    try:
        raw = await client.get_historical_tick_data(
            contract,
            EXCHANGE,
            start,
            end,
            wait=True,
            idle_timeout=8.0,
            max_pages=5,
        )
    except Exception as e:
        return 0

    existing = prints_by_root[root]
    seen = {(round(float(p["time"]), 3), p["price"], p["size"], p["side"]) for p in existing}
    added = 0
    fresh: List[dict] = []
    for d in raw or []:
        for pr in tick_bar_to_prints(d, contract):
            if "time_ms" not in pr:
                pr["time_ms"] = int(round(float(pr["time"]) * 1000))
            key = (round(float(pr["time"]), 3), pr["price"], pr["size"], pr["side"])
            if key in seen:
                continue
            seen.add(key)
            fresh.append(pr)

    fresh.sort(key=lambda p: p["time"])
    for pr in fresh:
        prints_by_root[root].append(pr)
        apply_print_to_bars(root, pr)
        added += 1
        await ws_broadcast(
            {
                "type": "trade",
                "symbol": root,
                "contract": CONTRACTS.get(root),
                "time": pr["time"],
                "time_ms": pr["time_ms"],
                "price": pr["price"],
                "size": pr["size"],
                "side": pr["side"],
                "origin": "poll",
            },
            {root},
        )

    if added:
        state["last_tick_at"] = time.time()
        state["live_trades"] = int(state.get("live_trades") or 0) + added
        # treat poll as live feed for UI
        if bars_by_root.get(root):
            state["symbols"][root] = contract
    return added


async def rithmic_worker():
    user = env("RITHMIC_USER")
    password = env("RITHMIC_PASSWORD")
    system_name = env("RITHMIC_SYSTEM", "Rithmic Test")
    url = env("RITHMIC_URL")
    app_name = env("RITHMIC_APP_NAME", "myapp-bridge")
    app_version = env("RITHMIC_APP_VERSION", "1.0.0")

    if not user or not password or not url:
        state["status"] = "waiting_credentials"
        state["connected"] = False
        state["error"] = "Set RITHMIC_USER, RITHMIC_PASSWORD, RITHMIC_URL in tools/rithmic-bridge/.env"
        print(f"[bridge] {state['error']}")
        return

    try:
        from async_rithmic import RithmicClient, DataType, SysInfraType, TimeBarType
    except Exception as e:
        state["status"] = "import_error"
        state["error"] = f"Cannot import async_rithmic ({e})"
        print(f"[bridge] {state['error']}")
        return

    client = RithmicClient(
        user=user,
        password=password,
        system_name=system_name,
        app_name=app_name,
        app_version=app_version,
        url=url,
    )
    client.ssl_context = make_ssl_context()
    client_ref["client"] = client

    @client.on_tick
    async def on_tick(data: dict):
        dt = data.get("data_type")
        try:
            dt_val = int(dt) if dt is not None else None
        except Exception:
            dt_val = getattr(dt, "value", None)

        sym = str(data.get("symbol") or data.get("trading_symbol") or "")
        root = root_of(sym)
        if root not in ("NQ", "ES"):
            return

        # BBO → keep last price alive + push ms quote over WS
        if dt_val == 2:
            state["live_bbo"] = int(state["live_bbo"]) + 1
            bid = data.get("bid_price")
            ask = data.get("ask_price")
            if bid is not None and ask is not None:
                mid = (float(bid) + float(ask)) / 2.0
                apply_quote_to_bars(root, mid)
                t = exchange_time_sec(data)
                state["last_tick_at"] = t
                state["symbols"][root] = sym or CONTRACTS.get(root)
                await ws_broadcast(
                    {
                        "type": "bbo",
                        "symbol": root,
                        "contract": CONTRACTS.get(root),
                        "time": t,
                        "time_ms": int(round(t * 1000.0)),
                        "bid": float(bid),
                        "ask": float(ask),
                        "mid": mid,
                    },
                    {root},
                )
            return

        pr = tick_to_print(data)
        if not pr:
            return
        state["live_trades"] = int(state["live_trades"]) + 1
        if int(state["live_trades"]) <= 3:
            print(f"[bridge] LIVE trade {root} {pr['side']} {pr['size']} @ {pr['price']} ms={pr['time_ms']}")
        prints_by_root[root].append(pr)
        state["last_tick_at"] = pr["time"]
        state["symbols"][root] = pr.get("symbol") or CONTRACTS.get(root)
        apply_print_to_bars(root, pr)
        await ws_broadcast(
            {
                "type": "trade",
                "symbol": root,
                "contract": CONTRACTS.get(root),
                "time": pr["time"],
                "time_ms": pr["time_ms"],
                "price": pr["price"],
                "size": pr["size"],
                "side": pr["side"],
                "ssboe": pr.get("ssboe"),
                "usecs": pr.get("usecs"),
            },
            {root},
        )

    @client.on_time_bar
    async def on_time_bar(data: dict):
        bar = rithmic_bar_to_json(data)
        if not bar:
            return
        root = root_of(str(data.get("symbol") or ""))
        if root in ("NQ", "ES"):
            upsert_bar(root, bar)
            await ws_broadcast(
                {
                    "type": "bar",
                    "symbol": root,
                    "contract": CONTRACTS.get(root),
                    "time_ms": int(bar["time"]) * 1000,
                    "bar": bar,
                },
                {root},
            )

    try:
        state["status"] = "connecting"
        await client.connect(plants=[SysInfraType.TICKER_PLANT, SysInfraType.HISTORY_PLANT])
        state["connected"] = True
        state["status"] = "connected"
        state["error"] = None
        print("[bridge] connected Rithmic Ticker + History Plant")

        for root in ("NQ", "ES"):
            try:
                try:
                    contract = await client.get_front_month_contract(root, EXCHANGE)
                except Exception as fe:
                    contract = None
                    print(f"[bridge] front month {root}: {fe}")
                if not contract:
                    contract = fallback_front_month(root)
                    print(f"[bridge] using fallback contract {root} → {contract}")
                CONTRACTS[root] = contract
                bits = int(DataType.LAST_TRADE) | int(DataType.BBO)
                await client.subscribe_to_market_data(contract, EXCHANGE, bits)
                await client.subscribe_to_time_bar_data(
                    contract, EXCHANGE, TimeBarType.MINUTE_BAR, 1
                )
                print(f"[bridge] subscribed {root} → {contract} (LAST_TRADE|BBO + 1m)")
                await load_history(client, root, contract)
                await load_tick_history(client, root, contract)
            except Exception as e:
                print(f"[bridge] setup {root} failed: {e}")
                state["error"] = str(e)

        print("[bridge] tick poll loop every 200ms (fills WS when LAST_TRADE silent)")
        resub_at = 0.0
        while True:
            await asyncio.sleep(0.2)
            if not state["connected"]:
                break
            for root, contract in list(CONTRACTS.items()):
                try:
                    n = await poll_new_ticks(client, root, contract)
                    if n:
                        print(f"[bridge] polled +{n} ticks {root}")
                except Exception as e:
                    print(f"[bridge] poll {root}: {e}")
            # Warm MD subscription at most every 30s
            now = time.time()
            if int(state.get("live_trades") or 0) == 0 and CONTRACTS and now - resub_at > 30:
                resub_at = now
                for root, contract in list(CONTRACTS.items()):
                    try:
                        bits = int(DataType.LAST_TRADE) | int(DataType.BBO)
                        await client.subscribe_to_market_data(contract, EXCHANGE, bits)
                    except Exception:
                        pass
    except Exception as e:
        state["connected"] = False
        state["status"] = "error"
        state["error"] = str(e)
        print(f"[bridge] fatal: {e}")
    finally:
        client_ref["client"] = None
        try:
            await client.disconnect()
        except Exception:
            pass
        state["connected"] = False
        if state["status"] == "connected":
            state["status"] = "disconnected"


async def handle_health(_: web.Request) -> web.Response:
    last_prices = {}
    for root, bars in bars_by_root.items():
        if bars:
            last_prices[root] = bars[-1]["close"]
    return web.json_response(
        {
            "ok": True,
            "status": state["status"],
            "connected": bool(state["connected"]),
            "error": state["error"],
            "contracts": CONTRACTS,
            "print_counts": {k: len(v) for k, v in prints_by_root.items()},
            "bar_counts": {k: len(v) for k, v in bars_by_root.items()},
            "bars_loaded": state["bars_loaded"],
            "prints_loaded": state["prints_loaded"],
            "live_trades": state["live_trades"],
            "live_bbo": state["live_bbo"],
            "last_prices": last_prices,
            "last_tick_at": state["last_tick_at"],
            "backend": "async_rithmic",
            "feed": "rithmic_only",
            "version": BRIDGE_VERSION,
            "ws": f"ws://127.0.0.1:{PORT}/ws",
            "ws_clients": len(ws_clients),
        }
    )


async def handle_orderflow(request: web.Request) -> web.Response:
    symbol = (request.rel_url.query.get("symbol") or "NQ").upper()
    if symbol not in ("NQ", "ES"):
        return web.json_response({"error": "symbol must be NQ or ES"}, status=400)

    if not state["connected"]:
        return web.json_response(
            {
                "error": "bridge_not_connected",
                "status": state["status"],
                "detail": state["error"],
                "prints": [],
                "events": [],
                "source": "none",
            },
            status=503,
        )

    prints = list(prints_by_root.get(symbol, []))
    return web.json_response(
        {
            "symbol": symbol,
            "contract": CONTRACTS.get(symbol),
            "prints": prints[-2000:],
            "events": [],
            "source": "bridge",
            "last_price": bars_by_root[symbol][-1]["close"] if bars_by_root.get(symbol) else None,
        }
    )


async def handle_bars(request: web.Request) -> web.Response:
    symbol = (request.rel_url.query.get("symbol") or "NQ").upper()
    if symbol not in ("NQ", "ES"):
        return web.json_response({"error": "symbol must be NQ or ES"}, status=400)

    if not state["connected"]:
        return web.json_response(
            {
                "error": "bridge_not_connected",
                "status": state["status"],
                "detail": state["error"],
                "bars": [],
                "source": "none",
            },
            status=503,
        )

    bars = list(bars_by_root.get(symbol, []))
    return web.json_response(
        {
            "symbol": CONTRACTS.get(symbol) or symbol,
            "root": symbol,
            "contract": CONTRACTS.get(symbol),
            "bars": bars,
            "source": "bridge",
            "count": len(bars),
        }
    )


async def handle_ws(request: web.Request) -> web.WebSocketResponse:
    """
    Live tape over WebSocket with millisecond timestamps.

    Connect: ws://127.0.0.1:7788/ws?symbol=NQ
    Or send: {"op":"subscribe","symbol":"NQ"}

    Messages:
      hello | snapshot | trade | bbo | bar | ping
    """
    ws = web.WebSocketResponse(heartbeat=20)
    await ws.prepare(request)

    symbol = (request.rel_url.query.get("symbol") or "NQ").upper()
    roots: Set[str] = {symbol} if symbol in ("NQ", "ES") else {"NQ", "ES"}
    ws_clients[ws] = roots

    await ws.send_str(
        json.dumps(
            {
                "type": "hello",
                "connected": bool(state["connected"]),
                "status": state["status"],
                "contracts": CONTRACTS,
                "subscribed": list(roots),
                "version": BRIDGE_VERSION,
                "precision": "ms",
            },
            separators=(",", ":"),
        )
    )

    for root in roots:
        prints = list(prints_by_root.get(root, []))[-1500:]
        # ensure time_ms on historical prints
        for p in prints:
            if "time_ms" not in p and p.get("time") is not None:
                p["time_ms"] = int(round(float(p["time"]) * 1000))
        await ws.send_str(
            json.dumps(
                {
                    "type": "snapshot",
                    "symbol": root,
                    "contract": CONTRACTS.get(root),
                    "prints": prints,
                    "last_bar": bars_by_root[root][-1] if bars_by_root.get(root) else None,
                    "time_ms": int(time.time() * 1000),
                },
                separators=(",", ":"),
            )
        )

    try:
        async for msg in ws:
            if msg.type == WSMsgType.TEXT:
                try:
                    data = json.loads(msg.data)
                except json.JSONDecodeError:
                    continue
                op = data.get("op") or data.get("type")
                if op == "subscribe":
                    sym = str(data.get("symbol") or "").upper()
                    if sym in ("NQ", "ES"):
                        ws_clients[ws] = {sym}
                        await ws.send_str(
                            json.dumps(
                                {"type": "subscribed", "symbol": sym},
                                separators=(",", ":"),
                            )
                        )
                elif op == "ping":
                    await ws.send_str(
                        json.dumps(
                            {"type": "pong", "time_ms": int(time.time() * 1000)},
                            separators=(",", ":"),
                        )
                    )
            elif msg.type in (WSMsgType.CLOSE, WSMsgType.ERROR):
                break
    finally:
        ws_clients.pop(ws, None)

    return ws


async def on_startup(app: web.Application):
    app["worker"] = asyncio.create_task(rithmic_worker())


async def on_cleanup(app: web.Application):
    task = app.get("worker")
    if task:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass


def main():
    app = web.Application()
    app.router.add_get("/health", handle_health)
    app.router.add_get("/orderflow", handle_orderflow)
    app.router.add_get("/bars", handle_bars)
    app.router.add_get("/ws", handle_ws)
    app.on_startup.append(on_startup)
    app.on_cleanup.append(on_cleanup)
    print(f"[bridge] http://127.0.0.1:{PORT}  (Rithmic-only + WS ms tape)")
    print(f"[bridge] websocket: ws://127.0.0.1:{PORT}/ws?symbol=NQ")
    web.run_app(app, host="127.0.0.1", port=PORT, print=None)


if __name__ == "__main__":
    main()
