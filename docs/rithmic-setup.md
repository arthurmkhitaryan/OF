# Rithmic + Lucid setup (Phase 2)

## 1. Request Rithmic Dev Kit (R | Protocol API)

Official pages:
- https://www.rithmic.com/products/api-suite
- https://www.rithmic.com/apis

Request a **Protocol** Dev Kit with: full name, company/legal entity, mailing address, phone, email.

Flow:
1. Build against **Rithmic Test** (no conformance needed)
2. Pass **conformance** for production
3. Obtain live credentials via your FCM/prop (**LucidTrade**)

## 2. Ask Lucid support

```
After Rithmic Protocol conformance, can I use my Lucid Rithmic
username/password in a custom app (Ticker Plant + History Plant)
for NQ/ES market data, or is login limited to approved platforms
(Tradesea, MotiveWave, R|Trader only)?
```

## 3. Local bridge (this repo)

See `tools/rithmic-bridge/README.md`.

Environment (never commit secrets):

```
RITHMIC_USER=
RITHMIC_PASSWORD=
RITHMIC_SYSTEM=Rithmic Test
RITHMIC_BRIDGE_PORT=7788
```

When the bridge is running, the Live page will prefer:
`GET /api/market/bars?source=bridge` and stream OF events from the bridge.
