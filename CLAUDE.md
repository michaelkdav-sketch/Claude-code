# CLAUDE.md

This file provides guidance to AI assistants (Claude and others) working in this repository.

## Repository Overview

This is the `claude-code` repository owned by **michaelkdav-sketch**. It is currently in its initial state. As the codebase grows, this file should be updated to reflect the actual project structure, conventions, and workflows.

## Development Branch

- **Active development branch**: `claude/add-claude-documentation-IoMT4`
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

## File Conventions

- Prefer editing existing files over creating new ones
- Do not create documentation files (`.md`, `README`) unless explicitly requested
- Avoid adding comments or docstrings to code you didn't change
- Do not introduce speculative abstractions or future-proofing

## Security

- Never commit secrets, credentials, `.env` files, or API keys
- Validate input at system boundaries (user input, external APIs) only
- Avoid common OWASP vulnerabilities: SQL injection, XSS, command injection, etc.

## Working with AI Assistants

- This file (`CLAUDE.md`) is the primary reference for AI assistants working in this repo
- Keep this file up to date as the codebase evolves
- Add sections below as the project matures (e.g., build system, testing, deployment)

---

*This file will be expanded as the project structure is established.*
