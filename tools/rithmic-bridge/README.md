# Real market data bridge (Rithmic only)

1m candles + Last Trades from Rithmic History / Ticker Plant.
No Yahoo, no DEMO tape.

## Run

```bash
# from repo root (Windows-ok)
npm run bridge
```

Needs `tools/rithmic-bridge/.env`:

```
RITHMIC_USER=...
RITHMIC_PASSWORD=...
RITHMIC_SYSTEM=Rithmic Test
RITHMIC_URL=wss://rituz00100.rithmic.com:443
RITHMIC_SSL_VERIFY=0
RITHMIC_BRIDGE_PORT=7788
```

Root `.env`:

```
RITHMIC_BRIDGE_URL=http://127.0.0.1:7788
ALLOW_DEMO_OF=0
```

## Endpoints

| Path | Returns |
|------|---------|
| `/health` | connection, contracts, bar/print counts |
| `/bars?symbol=NQ` | 1m OHLC from History + live ticks |
| `/orderflow?symbol=NQ` | Last Trade prints for OF engine |
| **`/ws?symbol=NQ`** | **WebSocket tape with `time_ms` (source_ssboe+usecs)** |

WS messages: `hello` · `snapshot` · `trade` · `bbo` · `bar`

## Before first login

1. R \| Trader → **Rithmic Test** → sign agreements  
2. Then `npm run bridge`

Kit reference (local): `api/0.89.0.0/`
