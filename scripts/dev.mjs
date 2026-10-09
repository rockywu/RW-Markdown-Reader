import { spawn } from "node:child_process";
import { createServer } from "vite";
import electron from "electron";

const compile = spawn(
  process.execPath,
  ["node_modules/typescript/bin/tsc", "-p", "tsconfig.electron.json"],
  { stdio: "inherit" },
);
const code = await new Promise((resolve) => compile.on("exit", resolve));
if (code !== 0) process.exit(Number(code) || 1);
const server = await createServer();
await server.listen();
const child = spawn(electron, ["."], {
  stdio: "inherit",
  env: { ...process.env, MARKVIEW_DEV_URL: "http://127.0.0.1:5178/" },
});
child.on("exit", async () => {
  await server.close();
  process.exit(0);
});
process.on("SIGINT", () => child.kill());
process.on("SIGTERM", () => child.kill());
