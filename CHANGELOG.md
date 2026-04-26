# Changelog

All notable changes to this project will be documented in this file.

## 0.1.0 - 2026-04-27

Initial release of Skill Link. Rebranded from skills-manage with a refreshed visual identity and theme system.

### Features

- **Obsidian Light Theme**: Add a new light theme with a warm white base (`#ffffff`), subtle gray cards (`#f6f8fa`), and a purple accent (`#8250df`) inspired by the Obsidian app aesthetic.
- **Configurable Font Family**: Add a font picker in Settings → About with three options:
  - **Geist** — modern variable sans-serif
  - **JetBrains Mono** — monospace UI font
  - **System Font** — native OS font (default)
- **Theme & Font Persistence**: Theme and font choices are saved to `localStorage` and applied before first paint to prevent flash.

### Improvements

- Default dark-mode theme changed from Catppuccin Mocha to **Obsidian Light**.
- Default font changed from JetBrains Mono to **System Font**.
- Settings UI label "Flavor" renamed to **"Theme"**.
- `--hover-bg` color variable moved from global `:root` into per-theme blocks for correct color mapping.

### Fixes

- Fix font inheritance across the entire app (including sidebar) by setting `font-family` directly on the `<html>` element, since Tailwind v4 utilities inline the font stack at build time.

### Assets

- Regenerate all platform app icons (macOS `.icns`, Windows `.ico`, Linux PNG, Android mipmaps, iOS AppIcon sets) from an updated 1024×1024 source.
