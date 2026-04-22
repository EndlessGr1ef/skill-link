# User Testing

Testing surface, required tools, and validation constraints for the Claude multi-source scan mission.

## Validation Surface

### Primary surface: native Tauri app
- Run via `pnpm tauri dev`
- Validate the `Claude Code` platform page and the skill detail surface
- This is the authoritative user-facing surface because scan behavior depends on Rust/Tauri state

### Secondary automated surface: targeted tests
- Rust targeted tests for scanner/query/linker behavior
- Vitest targeted tests for `PlatformView`, `SkillDetailView`, `platformStore`, and `skillDetailStore`
- `pnpm typecheck` and `pnpm lint`

## Fixture Strategy

### Automated validation
Use an isolated HOME rooted at:
- `/tmp/skills-manage-test-fixtures/claude-multi-source`

Populate fixture inputs under:
- `/tmp/skills-manage-test-fixtures/claude-multi-source/.claude/skills`
- `/tmp/skills-manage-test-fixtures/claude-multi-source/.claude/plugins/marketplaces/<publisher-or-plugin>`

Automated validation should prove:
- one Claude platform can roll up both roots
- duplicate source rows remain distinct
- marketplace rows are read-only
- rescans update the live page without stale row corruption

### Final manual validation
After automated work is complete, run a real-home Tauri check using the user's actual:
- `~/.claude/skills`
- `~/.claude/plugins/marketplaces/*`

That manual pass should confirm the same behaviors against real Claude data without mutating plugin directories.

## Validation Commands

### Frontend targeted
- `pnpm exec vitest run src/test/platformStore.test.ts src/test/PlatformView.test.tsx src/test/SkillDetailView.test.tsx src/test/skillDetailStore.test.ts`
- `pnpm typecheck`
- `pnpm lint`

### Rust targeted
- `cargo test --manifest-path src-tauri/Cargo.toml scanner::tests::`
- `cargo test --manifest-path src-tauri/Cargo.toml skills::tests::`
- `cargo test --manifest-path src-tauri/Cargo.toml linker::tests::`

## Validation Concurrency

Machine profile from dry run:
- 12 CPU cores
- 48 GiB RAM
- significant unrelated background Node/process load already present

Mission limit:
- **Maximum 2 validation lanes total**
- At most **1 frontend lane + 1 Rust lane**
- Serialize heavy checks and native Tauri validation

## Required Evidence

For contract assertions on the native Tauri surface, capture:
- sidebar/platform screenshots
- list screenshots with source/read-only markers
- detail screenshots with rooted path and action affordances
- before/after screenshots for rescan flows
- brief notes for any disabled/blocked management action checks

## Important Constraints
- Browser-only Vite runs are not sufficient proof for this mission
- Marketplace rows must remain observational; validators must not treat absence of mutation as optional
- Use repeated-skill fixtures when validating duplicate-source behavior; distinct-name fixtures are insufficient
- For backend/frontend compatibility fixes that unblock scrutiny before the full Claude UX lands, a native launch/count smoke check is acceptable for that fix feature; the full duplicate-row click-through remains owned by later Claude UX features and final user-testing validation.
