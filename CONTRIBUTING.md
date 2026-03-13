# Contributing to Web to SVG

Hey👋

Thanks for taking interest in contributing to this project! This is my first real open-source project so im actively learning how to organize this :)

## About the project

I am a developer and designer creating a lot of websites for an Oslo based agency by day. This is my first extension help my own workflow. I spent alot of time with Claude Code to create this, so there is likely a lot that can be trimmed, reviewed and improved, not to mention various bugs.

Dont worry! I'm commited to learning by doing here, if you see something PLEASE PLEASE share as PRs, Issues or by email to markusevanger@gmail.com :D

## What to contribute to

The **extension** (`apps/extension/`) is the core product and where contributions are most welcome — bug fixes, new features, performance improvements, SVG edge cases, etc.

The website and studio (`apps/web/`, `apps/studio/`) are managed separately, so please focus PRs on the extension and shared packages.

## Setup

1. Fork and clone the repo
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Build and test the extension:
   ```bash
   pnpm dev:extension
   ```
4. Open `chrome://extensions/`, enable Developer Mode
5. Click "Load unpacked" and select `apps/extension/dist/`

No environment variables or API keys needed for extension development.

## Pull Requests

- Keep PRs focused — one feature or fix per PR
- Test the extension manually before submitting (no automated tests yet)

## Project Structure

| Directory              | What it is                          |
| ---------------------- | ----------------------------------- |
| `apps/extension/`      | Chrome Extension (Manifest V3)      |
| `packages/svg-engine/` | Shared SVG conversion engine        |
| `apps/web/`            | Marketing site (managed separately) |
| `apps/studio/`         | Sanity Studio (managed separately)  |

## Reporting Bugs

Open an issue with:

- Steps to reproduce
- Expected vs actual behavior
- Browser version and OS
- Screenshot or screen recording if relevant
