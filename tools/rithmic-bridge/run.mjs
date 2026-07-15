import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const py =
  process.platform === "win32"
    ? path.join(dir, ".venv", "Scripts", "python.exe")
    : path.join(dir, ".venv", "bin", "python");
const script = path.join(dir, "server.py");

const child = spawn(py, [script], {
  cwd: dir,
  stdio: "inherit",
  env: process.env,
});

child.on("error", (err) => {
  console.error(
    "[bridge] Failed to start. Create venv first:\n" +
      "  cd tools/rithmic-bridge && py -3.13 -m venv .venv && .venv\\Scripts\\pip install -r requirements.txt\n",
    err.message
  );
  process.exit(1);
});

child.on("exit", (code) => process.exit(code ?? 1));
