import { spawn } from "node:child_process";

const port = process.env.EXPO_PORT ?? "8081";
const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";
const child = spawn(npxCommand, ["expo", "start", "--web", "--port", port], {
  stdio: "inherit",
  env: {
    ...process.env,
    EXPO_USE_METRO_WORKSPACE_ROOT: "1",
  },
});

child.on("error", (error) => {
  console.error(`[metro] Failed to start Expo: ${error.message}`);
  process.exit(1);
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
