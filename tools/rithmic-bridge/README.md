# Rithmic Bridge (Phase 2 stub)

Local service that will connect to **R | Protocol API** and feed the Next.js journal.

## Status

Stub only — waits for Rithmic Dev Kit + Lucid permission.

## Planned endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Bridge up |
| GET | `/bars?symbol=NQ\|ES` | History Plant bars |
| GET | `/stream` | SSE/WebSocket tick + T&S |
| GET | `/orderflow?symbol=NQ\|ES` | Aggregated big trades / delta levels |

## Run (later)

```bash
# after Protocol SDK is available
cd tools/rithmic-bridge
npm install
npm run start
```

Journal expects `RITHMIC_BRIDGE_URL=http://127.0.0.1:7788` in `.env`.

## Order flow rules (OrderFlowEngine)

- Big trade: NQ ≥ 75 lots / ES ≥ 200 lots
- Absorption: heavy volume/delta, price does not continue
- Trapped: look above/below & fail + reclaim
