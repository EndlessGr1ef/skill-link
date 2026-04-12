# Environment

## Required Tools
- Rust 1.88+ / Cargo 1.91+
- Node.js 24+ / pnpm 10+
- Tauri CLI v2 (@tauri-apps/cli as devDependency)

## Key Paths
- Project root: `/Users/happypeet/Documents/GitHubMe/skills-manage`
- App data: `~/.skillsmanage/db.sqlite`
- Central Skills: `~/.agents/skills/`
- Reference project: `./reference/skillsgate/` (read-only reference, do not modify)

## Notes
- macOS is the primary target. Use `cfg!(target_os = "macos")` guards where needed.
- On macOS, symlinks work natively; on Windows use `junction` type.
- Tauri dev server runs on port 24200 (custom, to avoid conflicts with other services).
- The `reference/` directory is in .gitignore — it is not part of the project source.
- In worker shells, `pnpm` may be unavailable even though the repo is pnpm-based; `bun run --cwd /Users/happypeet/Documents/GitHubMe/skills-manage <script>` works as a fallback for package-script validators (`test`, `typecheck`, `lint`).
