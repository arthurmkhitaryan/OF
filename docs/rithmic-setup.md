# Rithmic only → Live chart + Order Flow

## Goal

`/live` candles, price, Big / Abs / Δ / Trapped — **only from Rithmic bridge**.
Yahoo and DEMO are disabled.

Stack: [async_rithmic](https://github.com/rundef/async_rithmic) →
`tools/rithmic-bridge/server.py` → `RITHMIC_BRIDGE_URL` → Next.js

## Local kit

`api/0.89.0.0/` (gitignored): proto, Reference_Guide.pdf, SSL cert, samples.

## Run

1. R | Trader → **Rithmic Test** → sign agreements  
2. `npm run bridge`  
3. `npm run dev` → `/live` → `price: bridge`, `OF: bridge`

## Env

`tools/rithmic-bridge/.env`:

```
RITHMIC_USER=...
RITHMIC_PASSWORD=...
RITHMIC_SYSTEM=Rithmic Test
RITHMIC_URL=wss://rituz00100.rithmic.com:443
RITHMIC_SSL_VERIFY=0
```

Root `.env`:

```
RITHMIC_BRIDGE_URL=http://127.0.0.1:7788
ALLOW_DEMO_OF=0
```

## Verify

`GET http://127.0.0.1:7788/health` → `connected`, `bar_counts`, growing `print_counts`

GEX remains CBOE (options), not Rithmic.
