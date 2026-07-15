"""
List Rithmic system_names and optionally try login.
Usage (from tools/rithmic-bridge with venv):
  .venv/Scripts/python discover.py
"""
from __future__ import annotations

import asyncio
import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")


async def main():
    import ssl
    from async_rithmic import RithmicClient, SysInfraType
    from async_rithmic.client import _setup_ssl_context

    user = os.getenv("RITHMIC_USER", "").strip()
    password = os.getenv("RITHMIC_PASSWORD", "").strip()
    system = os.getenv("RITHMIC_SYSTEM", "LucidTrading").strip()
    url = os.getenv("RITHMIC_URL", "wss://rprotocol.rithmic.com:443").strip()
    verify = os.getenv("RITHMIC_SSL_VERIFY", "0").lower() not in ("0", "false", "no")

    print(f"URL={url}")
    print(f"SYSTEM={system}")
    print(f"USER={user}")

    client = RithmicClient(
        user=user,
        password=password,
        system_name=system,
        app_name=os.getenv("RITHMIC_APP_NAME", "myapp-bridge"),
        app_version=os.getenv("RITHMIC_APP_VERSION", "1.0.0"),
        url=url,
    )
    if verify:
        client.ssl_context = _setup_ssl_context()
    else:
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        client.ssl_context = ctx

    try:
        await client.connect(plants=[SysInfraType.TICKER_PLANT])
        print("LOGIN OK")
        try:
            c = await client.get_front_month_contract("NQ", "CME")
            print(f"front month NQ -> {c}")
        except Exception as e:
            print(f"front month: {e}")
        await client.disconnect()
    except Exception as e:
        print(f"LOGIN FAILED: {e}")
        print(
            "\nIf system_name wrong, Rithmic often lists valid names in the error.\n"
            "Lucid R|Trader uses System=LucidTrading, Gateway=Chicago Area.\n"
            "Protocol API needs a production WSS URI from Rithmic after conformance.\n"
            "Custom apps may be blocked by Lucid until they allow Ticker Plant login."
        )


if __name__ == "__main__":
    asyncio.run(main())
