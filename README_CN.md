# Skill Link

Skill Link 是一个本地优先的桌面应用，用来把 AI Agent 技能集中管理在一个中央库里，再按需链接到你实际使用的工具和项目中。

[English](README.md) | [中文文档](README_CN.md)

---

> **致谢**
>
> Skill Link 是 [skills-manage](https://github.com/iamzhihuix/skills-manage)（作者：[iamzhihuix](https://github.com/iamzhihuix)）的硬分叉。skills-manage 是一个出色的跨平台 Skill 管理工具。本分支在此基础上增加了新的功能、不同的设计选择，并向独立方向持续开发。

> **免责声明**
>
> Skill Link 是一个独立的非官方桌面应用，用于管理本地 skill 目录并导入公开 skill 元数据。它与 Anthropic、OpenAI、GitHub、MiniMax 或其他受支持平台、发布方、商标所有者均无隶属、背书或赞助关系。

## 为什么需要它

越来越多 AI 编码工具开始采用同一种模式：一个 skill 是包含 `SKILL.md` 和可选配套文件的目录。麻烦在于，每个工具读取 skill 的位置都不一样。

Skill Link 使用 `~/.agents/skills/` 作为 canonical 中央目录，再把其中的技能通过符号链接或复制安装到 Claude Code、Codex CLI、Cursor、OpenCode、Gemini CLI、Kiro、Windsurf、Lobster 系工具、自定义平台，以及项目级 skill 目录。

## 你可以做什么

- 在 `~/.agents/skills/` 建立唯一的中央技能库。
- 通过平台图标快速安装或卸载 skill。
- 把中央 skill 安装到项目级 skill 目录，或任意自定义目标路径。
- 从 GitHub 仓库、官方目录、skill.sh、本地项目扫描结果导入 skill。
- 追踪 GitHub 来源 skill，检测上游更新，并一键更新到最新版本。
- 给已有本地 skill 绑定 GitHub 来源，之后继续参与更新检测。
- 浏览 skill 内部的完整文件树，而不只是 `SKILL.md`。
- 用集合组织可复用 skill 组合，并批量安装。
- 将元数据、设置、集合、扫描结果保存在本地 SQLite 数据库中。

## 近期方向

最近一段时间的改动让 Skill Link 从“跨平台安装器”进一步变成了完整的 skill 生命周期工具：

- **项目安装** - 中央 skill 可以按平台约定安装进指定项目的 project skill 目录。
- **自定义路径安装** - 对尚未内置的平台，也可以把 skill 链接或复制到任意目标目录。
- **GitHub 更新流** - 导入的 skill 会记录来源仓库、来源路径、分支/ref、安装时 commit，用来和上游最新 commit 对比。
- **一键更新** - 可更新 skill 会从来源重新拉取，更新前做校验并创建本地备份，激活失败时回滚。
- **本地 skill 绑定 GitHub** - 旧版本导入或手动创建的 skill 可以补充 GitHub 来源，无需重新导入。
- **更安全的中央删除** - 删除中央 skill 时会清理已跟踪安装，同时避免误删未跟踪的真实目录。
- **更清晰的详情页** - metadata 可折叠，GitHub 来源信息更醒目，重复/只读来源更容易对比。

## Skill 来源

| 来源 | 用途 |
|------|------|
| 中央技能库 | 管理 `~/.agents/skills/` 中已有技能 |
| GitHub 导入 | 导入公开仓库，包括根目录 skill 和 `skills/` 子目录 |
| skill.sh | 搜索 skill.sh、查看远程目录并直接安装 |
| 官方目录 | 浏览 registry / publisher 风格的技能列表 |
| 项目扫描 | 在磁盘上发现未管理的 `SKILL.md` 并纳入中央管理 |
| 自定义路径 | 从用户选择的目录导入或安装 skill |

## 项目截图

### 中央技能库与平台安装

![中央技能库视图](images/01.png)

### Skill 详情与文件树

![Skill 详情与文件树](images/05.png)

### 平台技能视图

![平台技能视图](images/06.png)

### Find Skill

![Find Skill](images/04.png)

### GitHub 导入

![GitHub 仓库导入向导](images/02.png)

### 项目技能发现

![项目技能库发现页](images/03.png)

## 下载

- 最新发布：<https://github.com/EndlessGr1ef/skill-link/releases/latest>
- 当前已提供的预编译安装包：Apple Silicon macOS（`.dmg` 和 `.app.zip`）
- 其他平台：当前请从源码运行

### macOS 未签名构建说明

当前公开发布的 macOS 安装包还没有 notarization。如果 macOS 提示：

- `"Skill Link" is damaged and can't be opened`
- `"Skill Link" cannot be opened because Apple could not verify it`

这通常不代表安装包真的损坏，而是未签名应用被 Gatekeeper 的 quarantine 机制拦截。

把应用移动到 `/Applications` 后，执行：

```bash
xattr -dr com.apple.quarantine "/Applications/Skill Link.app"
```

然后回到 Finder 再次打开应用。如果你的应用不在 `/Applications`，把命令中的路径替换成实际 `.app` 路径即可。

## 支持的平台

| 类别 | 平台 | 全局 Skills 目录 | 项目目录 |
|------|------|-----------------|----------|
| Coding | Claude Code | `~/.claude/skills/` | `.claude/skills/` |
| Coding | Codex CLI | `~/.agents/skills/` | `.agents/skills/` |
| Coding | Cursor | `~/.cursor/skills/` | `.cursor/skills/` |
| Coding | Gemini CLI | `~/.gemini/skills/` | `.gemini/skills/` |
| Coding | Trae | `~/.trae/skills/` | `.trae/skills/` |
| Coding | Factory Droid | `~/.factory/skills/` | `.factory/skills/` |
| Coding | Junie | `~/.junie/skills/` | `.junie/skills/` |
| Coding | Qwen | `~/.qwen/skills/` | `.qwen/skills/` |
| Coding | Trae CN | `~/.trae-cn/skills/` | `.trae-cn/skills/` |
| Coding | Windsurf | `~/.windsurf/skills/` | `.windsurf/skills/` |
| Coding | Qoder | `~/.qoder/skills/` | `.qoder/skills/` |
| Coding | Augment | `~/.augment/skills/` | `.augment/skills/` |
| Coding | OpenCode | `~/.opencode/skills/` | `.opencode/skills/` |
| Coding | KiloCode | `~/.kilocode/skills/` | `.kilocode/skills/` |
| Coding | OB1 | `~/.ob1/skills/` | `.ob1/skills/` |
| Coding | Amp | `~/.amp/skills/` | `.amp/skills/` |
| Coding | Kiro | `~/.kiro/skills/` | `.kiro/skills/` |
| Coding | CodeBuddy | `~/.codebuddy/skills/` | `.codebuddy/skills/` |
| Coding | Copilot | `~/.copilot/skills/` | `.copilot/skills/` |
| Coding | Aider | `~/.aider/skills/` | `.aider/skills/` |
| Lobster | Hermes | `~/.hermes/skills/` | - |
| Lobster | OpenClaw | `~/.openclaw/skills/` | - |
| Lobster | QClaw | `~/.qclaw/skills/` | - |
| Lobster | EasyClaw | `~/.easyclaw/skills/` | - |
| Lobster | AutoClaw | `~/.openclaw-autoclaw/skills/` | - |
| Lobster | WorkBuddy | `~/.workbuddy/skills-marketplace/skills/` | - |
| Central | Central Skills | `~/.agents/skills/` | - |

也可以在 Settings 中添加自定义平台。

> 注意：Claude Code 还可能在 Claude 视图中显示 `~/.claude/plugins/marketplaces/*` 下的 Find Skill 插件目录。这些条目是只读展示项，不会像 `~/.claude/skills/` 中的原生 skill 一样被管理。

## 隐私与安全

- **本地优先** - 元数据、集合、扫描结果、设置、更新缓存和 AI explanation 都保存在 `~/.skill-link/db.sqlite` 或你自己管理的本地 skill 目录中。
- **无遥测** - 应用不包含分析、崩溃上报或使用追踪。
- **网络访问由功能触发** - 只有使用 Find Skill 同步/下载、skill.sh 搜索/安装、GitHub 导入/更新检测或 AI explanation 时才会发起外部请求。
- **凭据仅本地存储** - GitHub PAT 和 AI API key 会保存在本地 SQLite settings 表中，应用本身不提供静态加密。
- **更新备份** - GitHub skill 更新会在 `~/.skill-link/backups` 下创建本地备份。

不要在 issue、PR、截图或日志里公开真实密钥。

## 技术栈

| 层 | 技术 |
|----|------|
| 桌面框架 | Tauri v2 |
| 前端 | React 18.3.1、TypeScript、Tailwind CSS 4 |
| UI | shadcn/ui、Base UI、Lucide icons、LobeHub icons |
| 状态管理 | Zustand |
| Markdown | react-markdown、remark-gfm、gray-matter |
| 国际化 | react-i18next、i18next-browser-languagedetector |
| 后端 | Rust、SQLx、serde、reqwest |
| 数据库 | SQLite via SQLx，WAL 模式 |
| 路由 | react-router-dom v7 |
| 测试 | Vitest、React Testing Library、Cargo tests |

## 开发

### 前置依赖

- [Node.js](https://nodejs.org/) 20 或更新版本
- [pnpm](https://pnpm.io/) 10.12.3 或更新版本
- [Rust toolchain](https://rustup.rs/) stable
- Tauri v2 系统依赖：<https://v2.tauri.app/start/prerequisites/>

### 安装依赖

```bash
pnpm install
```

### 启动

```bash
pnpm dev
```

单独前端 Vite 服务使用 `24200` 端口。

完整桌面应用：

```bash
pnpm tauri dev
```

`pnpm tauri dev` 会通过 `src-tauri/tauri.conf.json` 自动启动 Vite，不需要再手动开第二个 Vite 服务。

### 验证

前端 CI 顺序：

```bash
pnpm typecheck
pnpm lint
pnpm test
```

后端 CI 顺序：

```bash
cd src-tauri
cargo fmt --check
cargo clippy -- -D warnings
cargo test
```

聚焦测试示例：

```bash
pnpm test -- src/test/skillStore.test.ts
cd src-tauri && cargo test db::
```

## 项目结构

```text
skill-link/
├── src/                        # React 前端
│   ├── components/             # UI 组件
│   ├── data/                   # 内置 marketplace 和 provider 数据
│   ├── i18n/                   # 语言文件和 i18n 配置
│   ├── lib/                    # 前端工具函数
│   ├── pages/                  # 路由页面
│   ├── stores/                 # Zustand stores 和 Tauri IPC 边界
│   ├── test/                   # Vitest + RTL 测试
│   └── types/                  # 共享 TypeScript 类型
├── src-tauri/                  # Rust 后端
│   └── src/
│       ├── commands/           # 按领域拆分的 Tauri IPC 处理器
│       ├── db.rs               # SQLite schema、迁移、查询
│       ├── lib.rs              # Tauri 初始化与命令注册
│       └── main.rs             # 桌面入口
├── images/                     # README 截图
├── public/                     # 静态资源
├── CHANGELOG.md                # 英文更新日志
├── CHANGELOG.zh.md             # 中文更新日志
└── release-notes/              # GitHub release notes
```

## 数据库

Skill Link 会自动初始化 SQLite：

```text
~/.skill-link/db.sqlite
```

中央 skill 来源目录仍然是：

```text
~/.agents/skills/
```

## 更新日志

- 英文：[CHANGELOG.md](CHANGELOG.md)
- 中文：[CHANGELOG.zh.md](CHANGELOG.zh.md)

## 参与贡献

开发环境、验证命令和 PR 约定见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 安全报告

漏洞反馈和数据处理说明见 [SECURITY.md](SECURITY.md)。

## 许可证

本项目使用 Apache License 2.0，详见 [LICENSE](LICENSE)。
