# Rithmic + Lucid → real Order Flow (no DEMO)

## Goal

`/live` Big trades · Absorption · Delta · Trapped from **real Last Trades**, not
synthetic tape.

Stack:
[async_rithmic](https://github.com/rundef/async_rithmic) → `tools/rithmic-bridge/server.py`
→ `RITHMIC_BRIDGE_URL` → Next.js OrderFlowEngine.

## 1. Request Rithmic Dev Kit

- https://www.rithmic.com/products/api-suite  
- https://www.rithmic.com/apis  

You need WSS gateway URLs (`servers.toml`). Put Test URL into `RITHMIC_URL`.

Flow: build on **Rithmic Test** → conformance → Lucid live login.

## 2. Ask Lucid support

```
After Rithmic Protocol conformance, can I use my Lucid Rithmic
username/password in a custom app (Ticker Plant + History Plant)
for NQ/ES market data / Last Trades, or is login limited to approved
platforms (Tradesea, MotiveWave, R|Trader only)?
```

## 3. Run bridge

See `tools/rithmic-bridge/README.md`.

```
RITHMIC_USER=...
RITHMIC_PASSWORD=...
RITHMIC_SYSTEM=LucidTrading   # or name from R|Trader dropdown
RITHMIC_URL=wss://...         # from Dev Kit
RITHMIC_BRIDGE_PORT=7788
```

Journal `.env`:

```
RITHMIC_BRIDGE_URL=http://127.0.0.1:7788
ALLOW_DEMO_OF=0
```

## 4. Verify

1. `GET http://127.0.0.1:7788/health` → `connected: true`, rising `print_counts`
2. `/live` → badge **OF: bridge**, delta & events fill without DEMO label

Related open-source clients:
- https://github.com/rundef/async_rithmic (used here)
- https://github.com/BurnOutTrader/ff_rithmic_api (Rust reference)
