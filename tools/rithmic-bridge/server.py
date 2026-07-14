"""
Rithmic → HTTP bridge for myapp Live chart + Order Flow.

Requires:
  - Rithmic Protocol Dev Kit (WSS gateway URL)
  - Lucid (or Test) username/password with Ticker Plant access
  - Python 3.11 or 3.12 (3.14 may break protobuf)

Env (see .env.example):
  RITHMIC_USER, RITHMIC_PASSWORD, RITHMIC_SYSTEM, RITHMIC_URL
  RITHMIC_APP_NAME, RITHMIC_BRIDGE_PORT
"""

from __future__ import annotations

import asyncio
import os
import time
from collections import defaultdict, deque
from dataclasses import dataclass, field
from typing import Any, Deque, Dict, List, Optional

from aiohttp import web

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass

PORT = int(os.getenv("RITHMIC_BRIDGE_PORT", "7788"))
MAX_PRINTS = 2000
EXCHANGE = "CME"

# Soft root → front month contract cache
CONTRACTS: Dict[str, str] = {}

prints_by_root: Dict[str, Deque[dict]] = defaultdict(lambda: deque(maxlen=MAX_PRINTS))
state: Dict[str, Any] = {
    "status": "starting",
    "connected": False,
    "error": None,
    "symbols": {},
    "last_tick_at": None,
}


def env(name: str, default: str = "") -> str:
    return (os.getenv(name) or default).strip()


def root_of(symbol: str) -> str:
    s = symbol.upper()
    if s.startswith("NQ"):
        return "NQ"
    if s.startswith("ES"):
        return "ES"
    return s[:2]


def tick_to_print(data: dict) -> Optional[dict]:
    """Map async_rithmic on_tick LastTrade dict → our TickPrint JSON."""
    if data.get("data_type") is not None:
        # DataType.LAST_TRADE == 1; BBO == 2 — skip BBO
        dt = data["data_type"]
        try:
            val = int(dt)
        except Exception:
            val = getattr(dt, "value", None)
        if val is not None and val != 1:
            return None

    price = data.get("trade_price") or data.get("price")
    size = data.get("trade_size") or data.get("size") or data.get("volume")
    if price is None or size is None:
        return None

    agg = str(
        data.get("aggressor")
        or data.get("aggressor_side")
        or data.get("transaction_type")
        or ""
    ).upper()
    if "BUY" in agg or agg in ("1", "B", "BID"):
        side = "BUY"
    elif "SELL" in agg or agg in ("2", "S", "ASK"):
        side = "SELL"
    else:
        # presence bits heuristics — default buy if unknown
        side = "BUY"

    dt = data.get("datetime")
    if dt is not None and hasattr(dt, "timestamp"):
        t = float(dt.timestamp())
    else:
        ssboe = data.get("ssboe")
        usecs = data.get("usecs") or 0
        t = float(ssboe) + float(usecs) / 1_000_000.0 if ssboe else time.time()

    return {
        "time": t,
        "price": float(price),
        "size": int(size),
        "side": side,
        "symbol": data.get("symbol") or data.get("trading_symbol"),
    }


async def rithmic_worker():
    user = env("RITHMIC_USER")
    password = env("RITHMIC_PASSWORD")
    system_name = env("RITHMIC_SYSTEM", "Rithmic Test")
    url = env("RITHMIC_URL")  # e.g. wss://… from Dev Kit servers.toml
    app_name = env("RITHMIC_APP_NAME", "myapp-bridge")
    app_version = env("RITHMIC_APP_VERSION", "1.0.0")

    if not user or not password or not url:
        state["status"] = "waiting_credentials"
        state["connected"] = False
        state["error"] = (
            "Set RITHMIC_USER, RITHMIC_PASSWORD, RITHMIC_URL (from Dev Kit). "
            "Ask Lucid if Protocol login is allowed."
        )
        print(f"[bridge] {state['error']}")
        return

    try:
        from async_rithmic import RithmicClient, DataType, SysInfraType
    except Exception as e:
        state["status"] = "import_error"
        state["error"] = (
            f"Cannot import async_rithmic ({e}). Use Python 3.11/3.12: "
            "pip install -r requirements.txt"
        )
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

    @client.on_tick
    async def on_tick(data: dict):
        pr = tick_to_print(data)
        if not pr:
            return
        root = root_of(str(pr.get("symbol") or ""))
        if root not in ("NQ", "ES"):
            # still store under symbol root if front month like NQU6
            sym = str(data.get("symbol") or "")
            root = root_of(sym)
        if root in ("NQ", "ES"):
            prints_by_root[root].append(pr)
            state["last_tick_at"] = time.time()
            state["symbols"][root] = pr.get("symbol")

    try:
        state["status"] = "connecting"
        await client.connect(plants=[SysInfraType.TICKER_PLANT, SysInfraType.HISTORY_PLANT])
        state["connected"] = True
        state["status"] = "connected"
        state["error"] = None
        print("[bridge] connected to Rithmic Ticker Plant")

        for root in ("NQ", "ES"):
            try:
                contract = await client.get_front_month_contract(root, EXCHANGE)
                CONTRACTS[root] = contract
                await client.subscribe_to_market_data(contract, EXCHANGE, DataType.LAST_TRADE)
                print(f"[bridge] subscribed LAST_TRADE {root} → {contract}")
            except Exception as e:
                print(f"[bridge] subscribe {root} failed: {e}")
                state["error"] = str(e)

        # keep alive
        while True:
            await asyncio.sleep(30)
            if not state["connected"]:
                break
    except Exception as e:
        state["connected"] = False
        state["status"] = "error"
        state["error"] = str(e)
        print(f"[bridge] fatal: {e}")
    finally:
        try:
            await client.disconnect()
        except Exception:
            pass
        state["connected"] = False
        if state["status"] == "connected":
            state["status"] = "disconnected"


async def handle_health(_: web.Request) -> web.Response:
    return web.json_response(
        {
            "ok": True,
            "status": state["status"],
            "connected": bool(state["connected"]),
            "error": state["error"],
            "contracts": CONTRACTS,
            "print_counts": {k: len(v) for k, v in prints_by_root.items()},
            "last_tick_at": state["last_tick_at"],
            "backend": "async_rithmic",
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
            },
            status=503,
        )

    prints = list(prints_by_root.get(symbol, []))
    return web.json_response(
        {
            "symbol": symbol,
            "contract": CONTRACTS.get(symbol),
            "prints": prints[-500:],
            "events": [],  # Next.js OrderFlowEngine classifies
            "source": "bridge",
        }
    )


async def handle_bars(request: web.Request) -> web.Response:
    # Phase: bars still come from Yahoo in Next until History Plant wired
    return web.json_response(
        {
            "error": "bars_via_yahoo",
            "detail": "Use Next.js Yahoo/bridge bars; OF prints are on /orderflow",
            "connected": state["connected"],
        },
        status=503,
    )


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
    app.on_startup.append(on_startup)
    app.on_cleanup.append(on_cleanup)
    print(f"[bridge] http://127.0.0.1:{PORT}  (async_rithmic)")
    web.run_app(app, host="127.0.0.1", port=PORT, print=None)


if __name__ == "__main__":
    main()
