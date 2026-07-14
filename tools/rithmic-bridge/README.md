# Real Order Flow bridge (async_rithmic)

Replaces DEMO tape with **live CME Last Trade** prints from Rithmic Ticker Plant
(Lucid / Test credentials).

## What you need first

1. **Rithmic Protocol Dev Kit** → https://www.rithmic.com/apis  
   You get WSS URLs for `servers.toml` → put Test URL in `RITHMIC_URL`.
2. Email **Lucid**: can this custom app login with your Lucid user (Ticker Plant)?
3. Python **3.11 or 3.12** (3.14 breaks protobuf today).

Library: [async_rithmic](https://github.com/rundef/async_rithmic)

## Install & run

```bash
cd tools/rithmic-bridge
py -3.12 -m venv .venv
# Windows:
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
# fill RITHMIC_USER / PASSWORD / URL / SYSTEM
python server.py
```

Health: http://127.0.0.1:7788/health  
Orderflow: http://127.0.0.1:7788/orderflow?symbol=NQ

## Journal `.env`

```
RITHMIC_BRIDGE_URL=http://127.0.0.1:7788
ALLOW_DEMO_OF=0
```

With bridge connected, `/live` shows `OF: bridge` and real Big / Abs / Δ / Trapped
from classified Last Trades. Demo synthesis is **off** by default.
