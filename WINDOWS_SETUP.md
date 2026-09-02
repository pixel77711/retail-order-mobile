# Windows and VS Code Setup

## Supported workflow

This repository is an Expo mobile application with a Node.js API. Windows is supported for local API development, Expo web preview, Android development, and Android device testing through Expo Go. The iOS simulator remains a macOS-only toolchain; Windows users should use a physical iPhone with an appropriate Expo workflow or validate iOS builds through a macOS CI or publishing environment.

## Prerequisites

Install the current Node.js LTS release, Git, pnpm, and Visual Studio Code. For Android development, install Android Studio, the Android SDK, an emulator or a USB-connected device, and enable USB debugging on the device. After installing pnpm, verify the tools from the VS Code PowerShell terminal:

```powershell
node --version
pnpm --version
git --version
```

Clone the private repository and install dependencies:

```powershell
gh repo clone pixel77711/retail-order-mobile
Set-Location retail-order-mobile
pnpm install
```

## Configuration

Set the project environment variables through the VS Code or project-management environment configuration rather than committing secrets. The API requires `DATABASE_URL`, `JWT_SECRET`, `VITE_APP_ID`, and `OAUTH_SERVER_URL` for authenticated production behavior. The native client requires `EXPO_PUBLIC_API_BASE_URL` to point to the reachable HTTPS API origin.

Run the cross-platform check from PowerShell:

```powershell
pnpm env:check
```

In development, missing API variables produce a warning so the local preview can still load. In production, missing required variables fail the process before the API starts.

## Start commands

The following commands work from PowerShell, Command Prompt, or the integrated VS Code terminal because they delegate environment handling to Node.js or `cross-env` rather than relying on shell-specific environment expansion.

| Goal | Command |
|---|---|
| Start API and Expo web preview | `pnpm dev` |
| Start only the API | `pnpm dev:server` |
| Start only Expo web preview | `pnpm dev:metro` |
| Use a different Expo port | `$env:EXPO_PORT="8082"; pnpm dev:metro` |
| Run TypeScript validation | `pnpm check` |
| Run tests | `pnpm test -- --run` |
| Run lint | `pnpm lint` |
| Build the API bundle | `pnpm build` |
| Start the production API | `pnpm start` |
| Open Android workflow | `pnpm android` |

After `pnpm dev`, open the Expo web URL printed by Metro. The API health endpoints are available at `http://localhost:3000/api/health` and `http://localhost:3000/api/ready` when the API is bound to port 3000.

## PowerShell troubleshooting

If PowerShell blocks a local script, do not bypass security broadly. The package scripts invoke Node and package binaries directly, so normal execution policy should be sufficient. If `pnpm` is not recognized after installation, close and reopen VS Code so the updated PATH is loaded. If port 3000 or 8081 is occupied, set `PORT` or `EXPO_PORT` in the current PowerShell session and rerun the relevant command.

The repository pins `tsx` to `4.23.13` and `esbuild` to `0.28.2`, which use the same binary version. If an older checkout still reports `Expected 0.27.2 but got 0.28.2`, update the checkout first; if the error persists, rebuild the local dependency tree from the lockfile:

```powershell
Remove-Item -Recurse -Force node_modules
pnpm install --force
```

A clean clone should not need this recovery step.

For Android device testing, connect the phone and verify it is visible with `adb devices`. If the device is not listed, install the OEM USB driver or use the emulator supplied by Android Studio. A Windows browser preview is useful for layout checks, but the authoritative native interaction test should run in Expo Go on the Android device.

## Release checks

Before publishing, run `pnpm env:check`, `pnpm check`, `pnpm test -- --run`, `pnpm lint`, and `pnpm build`. Confirm `/api/health` returns HTTP 200 and `/api/ready` returns HTTP 200 with `database: "ready"`. Use the platform Publish workflow for the mobile artifact; do not attempt to create a heavyweight APK directly inside the development sandbox.
