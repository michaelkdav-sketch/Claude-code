# CLAUDE.md

This file provides guidance to AI assistants (Claude and others) working in this repository.

## Repository Overview

This is the `claude-code` repository owned by **michaelkdav-sketch**. It currently contains a Python command-line tool for discovering and controlling Sonos speakers on a local network (`sonos.py`).

- **Language:** Python 3
- **External dependency:** [`soco`](https://pypi.org/project/soco/) — the SoCo library for Sonos UPnP control
- **No package manager configuration yet** (no `pyproject.toml`, `requirements.txt`, etc.)

## Codebase Structure

```
Claude-code/
├── CLAUDE.md       # This file — AI assistant guidance
└── sonos.py        # Sonos CLI controller (144 lines)
```

### `sonos.py`

A single-file CLI tool. Entry point is `main()`, guarded by `if __name__ == "__main__"`.

**Architecture:**

- `discover_devices()` — calls `soco.discover()`, returns a list of `SoCo` device objects
- `print_devices(devices)` — prints index, name, IP, volume, transport state, and current track for each device
- `get_device(devices, index)` — bounds-checked device selector; exits with error if invalid
- One `cmd_*` function per command (see table below), all with the signature `(devices, args)`
- `COMMANDS` dict maps command name strings to `(handler_fn, description_str)` tuples
- `usage()` — prints command list derived from `COMMANDS`

**Supported commands:**

| Command   | Args                        | Description                    |
|-----------|-----------------------------|--------------------------------|
| `status`  | —                           | List devices and playback state |
| `play`    | `[device_index]`            | Start playback                 |
| `pause`   | `[device_index]`            | Pause playback                 |
| `next`    | `[device_index]`            | Skip to next track             |
| `prev`    | `[device_index]`            | Go to previous track           |
| `volume`  | `<level> [device_index]`    | Set volume (0–100)             |
| `mute`    | `[device_index]`            | Mute device                    |
| `unmute`  | `[device_index]`            | Unmute device                  |
| `queue`   | `[device_index]`            | Display the current queue      |

`device_index` always defaults to `0` (first discovered device).

**Running the script:**
```bash
python3 sonos.py status
python3 sonos.py play 1        # second device
python3 sonos.py volume 40
python3 sonos.py --help
```

## Development Branch

- **Active development branch**: `claude/add-claude-documentation-Ctums`
- **Default/main branch**: `main` (once established)

Always develop on the designated feature branch and push there. Never push directly to `main` without explicit permission.

## Git Conventions

### Commit Messages
- Use clear, descriptive commit messages in the imperative mood (e.g., "Add feature X", "Fix bug in Y")
- Keep the subject line under 72 characters
- Reference issue numbers when applicable (e.g., `Fixes #42`)

### Branch Naming
- Feature branches: `feature/<short-description>`
- Bug fixes: `fix/<short-description>`
- Documentation: `docs/<short-description>`
- AI-generated branches follow the pattern: `claude/<description>-<id>`

### Push Protocol
- Always use `git push -u origin <branch-name>`
- On network failure, retry up to 4 times with exponential backoff (2s, 4s, 8s, 16s)
- Do NOT create pull requests unless explicitly asked

## GitHub Interaction

- Repository: `michaelkdav-sketch/claude-code`
- Use MCP GitHub tools (prefixed `mcp__github__`) for all GitHub interactions
- Do NOT interact with other repositories
- Post comments sparingly — only when genuinely necessary

## Python Conventions

- Target **Python 3** (shebang: `#!/usr/bin/env python3`)
- No type annotations currently used; adding them to modified functions is acceptable
- Prefer flat, function-based modules over class hierarchies for scripts of this size
- Exit with `sys.exit(1)` on user/device errors; `sys.exit(0)` on clean early exits (e.g., `--help`)
- No comments beyond this CLAUDE.md unless the reason is non-obvious

## File Conventions

- Prefer editing existing files over creating new ones
- Do not create documentation files (`.md`, `README`) unless explicitly requested
- Avoid adding comments or docstrings to code you didn't change
- Do not introduce speculative abstractions or future-proofing

## Security

- Never commit secrets, credentials, `.env` files, or API keys
- Validate input at system boundaries (user input, external APIs) only
- Avoid common OWASP vulnerabilities: SQL injection, XSS, command injection, etc.
- `sonos.py` communicates only over the local network via UPnP; no internet traffic

## Working with AI Assistants

- This file (`CLAUDE.md`) is the primary reference for AI assistants working in this repo
- Keep this file up to date as the codebase evolves
- Add sections below as the project matures (e.g., build system, testing, deployment)

---

*Last updated to reflect repository state as of 2026-04-17.*
