# Changelog

All notable changes to this project will be documented in this file.

## 0.2.0 - 2026-05-15

### Marketplace & Import

- Add Custom Market tabs backed by Git repositories and remove the old Official Directory tab.
- Generalize repository import from GitHub-only flows to generic Git server imports via `git clone`.
- Improve repository import UX with better `SKILL.md` previews and custom market content loading.
- Refresh recommended marketplace skills and add `talk-normal` to the curated list.

### Skill Management

- Add dynamic-link indicators for symlinked central skills and move the label next to the skill name.
- Rename the Lobster platform group to **AI Assistant** and prevent long group labels from wrapping on central skill cards.
- Pass symlink/copy install methods through discovered-skill centralization flows.

### Updates & Reliability

- Redesign skill update UI copy to distinguish skill updates from app/software updates.
- Fix stale central list data after a skill is updated.
- Replace `gray-matter` with `js-yaml` to avoid the eval-related security warning.
- Improve long-path handling in discovery dialogs and progress views.

## 0.1.0 - 2026-04-27

> **Skill Link** is the first release based on the [skills-manage](https://github.com/iamzhihuix/skills-manage) project by [iamzhihuix](https://github.com/iamzhihuix). This is a hard fork with a refreshed visual identity, new marketplace integrations, and expanded AI provider support.

### Branding & Identity

- Rebrand from `skills-manage` to **Skill Link** across the app, README, and documentation.
- Add upstream credit to `iamzhihuix/skills-manage` in README and CLAUDE.md.
- Regenerate all platform app icons from a new 1024×1024 source (macOS `.icns`, Windows `.ico`, Linux PNG, Android mipmaps, iOS AppIcon sets).

### Theme & Appearance

- **Obsidian Light Theme**: Add a new light theme with a warm white base (`#ffffff`), subtle gray cards (`#f6f8fa`), and a purple accent (`#8250df`) inspired by the Obsidian app aesthetic.
- **Configurable Font Family**: Add a font picker in Settings → About with three options:
  - **Geist** — modern variable sans-serif
  - **JetBrains Mono** — monospace UI font
  - **System Font** — native OS font (default)
- Default dark-mode theme changed from Catppuccin Mocha to **Obsidian Light**.
- Default font changed from JetBrains Mono to **System Font**.
- Settings UI label "Flavor" renamed to **"Theme"**.
- Fix font inheritance across the entire app (including sidebar) by setting `font-family` directly on the `<html>` element, since Tailwind v4 utilities inline the font stack at build time.

### Marketplace & Skills Discovery

- **skills.sh Integration**: Replace the previous marketplace implementation with full integration of [skill.sh](https://skill.sh) browsing, search, and install flows.
- **Detailed Skill View**: Add a rich skill detail experience with:
  - Browsable file tree with syntax-highlighted preview
  - GitHub star count and repository metadata
  - AI-generated skill explanations (with frontmatter-aware context)
- **GitHub Repository Import**: Support importing skills directly from GitHub repos with:
  - Preview before import
  - Mirror fallback retries
  - Optional authenticated requests via PAT
  - Post-import platform install flows

### AI Provider Settings

- **Per-Provider Configuration**: Each AI provider (Claude, GLM, MiniMax, Kimi, DeepSeek, Custom) now has independent settings.
- **Protocol Selector**: Choose between OpenAI and Anthropic API protocols for custom endpoints.
- **Connection Test**: Add a "Test Connection" button with loading state and result feedback.
- **Lazy Save**: Settings are saved on blur/change rather than requiring an explicit save action.
- **i18n**: All AI provider labels and descriptions are fully translated.

### Skill Management

- **Browsable File Tree**: Add a tree view inside skill detail drawers and pages to inspect every file in a skill with syntax-highlighted preview.
- **Custom Scan Directory Install**: Fix to allow installing skills from custom scan directories directly in the platform view.
- **Project-Level Installs**: Install central skills into project-local skill directories using each platform's project path convention.
- **Custom Path Installs**: Link or copy a central skill into any user-selected target directory.
- **Central Skill Deletion**: Add deletion from the central library with tracked install cleanup and safeguards for untracked real directories.
- **Platform Icon Display Controls**: Add persistent controls for hiding empty platform icons and sharing the show-all-platforms state across relevant views.

### GitHub Updates

- **Update Detection**: Track GitHub-backed skills by repository, source path, branch/ref, and installed commit SHA.
- **One-Click Updates**: Refresh updateable skills from their source with validation, local backups, and rollback on activation failure.
- **Link Local Skills to GitHub**: Attach an existing local skill to a GitHub source so it can participate in future update checks.
- **Import Fixes**: Fix root skill nested-folder imports and improve remote directory browse/install behavior.

### Detail View & Documentation

- Redesign the skill detail page with collapsible metadata, more prominent GitHub source information, and clearer duplicate/read-only source comparison.
- Show updated-time badges on central skill cards.
- Refresh README and Chinese README around the current product direction, supported platform table, Find Skill naming, screenshots, and development commands.

### Fixes

- `--hover-bg` color variable moved from global `:root` into per-theme blocks for correct color mapping across all themes.
- Fix race conditions and URL consistency in AI provider settings.
- Fix i18n key mismatches in AI settings labels.
- Respect English language selection for AI-generated explanations.
- Hide unavailable remote file trees in Find Skill detail drawers.
- Fix missing CSS and permissions for the overlay title bar drag region.
