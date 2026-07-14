/**
 * Stub HTTP server for Rithmic bridge.
 * Replace login/protocol calls when Dev Kit is available.
 */
import http from "node:http";

const PORT = Number(process.env.RITHMIC_BRIDGE_PORT ?? 7788);

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");

  if (url.pathname === "/health") {
    res.end(
      JSON.stringify({
        ok: true,
        status: "stub",
        message:
          "Rithmic Protocol not connected. Complete Dev Kit + Lucid gate. See docs/rithmic-setup.md",
      })
    );
    return;
  }

  if (url.pathname === "/orderflow") {
    // Ready shape for Protocol: return prints[] and/or events[]
    res.statusCode = 503;
    res.end(
      JSON.stringify({
        error: "bridge_not_connected",
        detail:
          "Waiting for R|Protocol. Expected JSON: { prints:[{time,price,size,side}], events? }",
      })
    );
    return;
  }

  if (url.pathname === "/bars") {
    res.statusCode = 503;
    res.end(
      JSON.stringify({
        error: "bridge_not_connected",
        detail: "Waiting for R|Protocol Dev Kit and Lucid credentials",
      })
    );
    return;
  }

  res.statusCode = 404;
  res.end(JSON.stringify({ error: "not_found" }));
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[rithmic-bridge stub] http://127.0.0.1:${PORT}`);
});
