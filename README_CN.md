# Skill Link

跨平台 AI Agent Skill 链接工具。从 skill.sh、官方目录、GitHub 仓库浏览、预览、安装技能，一站式完成。

[English](README.md) | [中文文档](README_CN.md)

---

> **致谢**
>
> Skill Link 是 [skills-manage](https://github.com/iamzhihuix/skills-manage)（作者：[iamzhihuix](https://github.com/iamzhihuix)）的硬分叉。skills-manage 是一个出色的跨平台 Skill 管理工具。本分支在此基础上增加了新的功能、不同的设计选择，并向独立方向持续开发。

> **免责声明**
>
> Skill Link 是一个独立的非官方桌面应用，用于管理本地 skill 目录并导入公开 skill 元数据。它与 Anthropic、OpenAI、GitHub、MiniMax 或其他受支持平台、发布方、商标所有者均无隶属、背书或赞助关系。

## 项目简介

Skill Link 遵循 [Agent Skills](https://github.com/anthropics/agent-skills) 的开放模式，使用 `~/.agents/skills/` 作为中央 canonical 目录，再通过符号链接把 skill 安装到各个平台，让同一份 skill 成为多个 AI coding 工具的单一事实来源。

## Skill Link 新增能力

相比上游 skills-manage，Skill Link 在以下方面做了增强：

- **skill.sh 集成** — 在应用内直接搜索 skill.sh、浏览远程目录结构、解析安装地址并一键安装，无需离开应用。
- **技能文件树** — 在 Skill 详情页和 Skill Market 详情抽屉中均可展开查看每个 skill 的内部文件结构，点击任意文件显示语法高亮预览。
- **Skill Market 来源统一** — 推荐 / 官方源目录 / skill.sh 三 Tab 并存于同一 Skill Market 页面。

## 核心能力

### 搜索与安装

- **skill.sh** — 搜索技能、浏览目录布局、一键安装到中央目录。
- **官方源目录** — 浏览经过 publisher 验证的技能目录，支持搜索筛选。
- **GitHub 导入** — 将任意公开 GitHub 仓库作为技能来源，支持鉴权请求与重试回退。
- **扫描发现（Discover）** — 在磁盘上定位未管理的项目级技能并纳入中央管理。
- **自定义扫描目录** — 从用户定义的路径安装技能。

### 检视与预览

- **技能文件树** — 可展开的目录树展示 skill 内全部文件；点击任意文件获取语法高亮预览。
- **Markdown 预览** — 渲染的 SKILL.md 文本，搭配 frontmatter 元数据侧栏。
- **AI 解释** — 自动生成技能功能的中文摘要。
- **原始源码** — 直接阅读 SKILL.md 及其配套文件。

### 管理

- **中央技能库** — `~/.agents/skills/` 单一事实来源。
- **按平台安装** — 通过符号链接或复制方式安装到任意支持的 AI 编码工具。
- **技能集合** — 将技能分组管理，支持批量安装和 JSON 导入/导出。
- **快速搜索** — 延迟查询、懒加载索引和虚拟列表，应对大规模技能库。

## 项目截图

### 中央技能库与平台安装

![中央技能库视图](images/01.png)

### 技能文件树 — 浏览 skill 内的每个文件

![技能文件树](images/07.png)

### 查看特定平台的已安装技能

![平台技能视图](images/06.png)

### 从 skill.sh 搜索和安装

![skill.sh 集成](images/08.png)

### 浏览 Skill Market 发布者与技能

![技能市场视图](images/04.png)

### 从 GitHub 仓库导入技能

![GitHub 仓库导入向导](images/02.png)

### 管理可复用技能集合

![技能集合视图](images/05.png)

### 扫描本地项目技能库

![项目技能库发现页](images/03.png)

## 下载

- 最新发布：<https://github.com/EndlessGr1ef/skill-link/releases/latest>
- 当前已提供的预编译安装包：Apple Silicon macOS（`.dmg` 和 `.app.zip`）
- 其他平台：当前请从源码运行

### macOS 未签名构建说明

当前公开发布的 macOS 安装包还没有 notarization。如果 macOS 提示：

![macOS 应用损坏警告](images/app-damaged.png)

- `"Skill Link" is damaged and can't be opened`
- `"Skill Link" cannot be opened because Apple could not verify it`

这通常不代表安装包真的损坏，而是未签名应用被 Gatekeeper 的 quarantine 机制拦截。

把应用移动到 `/Applications` 后，执行：

```bash
xattr -dr com.apple.quarantine "/Applications/Skill Link.app"
```

然后回到 Finder 再次打开应用。如果你的应用不在 `/Applications`，把命令中的路径替换成实际 `.app` 路径即可。

## 支持的平台

| 类别 | 平台 | Skills 目录 |
|------|------|------------|
| Coding | Claude Code | `~/.claude/skills/` |
| Coding | Codex CLI | `~/.agents/skills/` |
| Coding | Cursor | `~/.cursor/skills/` |
| Coding | Gemini CLI | `~/.gemini/skills/` |
| Coding | Trae | `~/.trae/skills/` |
| Coding | Factory Droid | `~/.factory/skills/` |
| Coding | Junie | `~/.junie/skills/` |
| Coding | Qwen | `~/.qwen/skills/` |
| Coding | Trae CN | `~/.trae-cn/skills/` |
| Coding | Windsurf | `~/.windsurf/skills/` |
| Coding | Qoder | `~/.qoder/skills/` |
| Coding | Augment | `~/.augment/skills/` |
| Coding | OpenCode | `~/.opencode/skills/` |
| Coding | KiloCode | `~/.kilocode/skills/` |
| Coding | OB1 | `~/.ob1/skills/` |
| Coding | Amp | `~/.amp/skills/` |
| Coding | Kiro | `~/.kiro/skills/` |
| Coding | CodeBuddy | `~/.codebuddy/skills/` |
| Coding | Hermes | `~/.hermes/skills/` |
| Coding | Copilot | `~/.copilot/skills/` |
| Coding | Aider | `~/.aider/skills/` |
| Lobster | OpenClaw（开爪） | `~/.openclaw/skills/` |
| Lobster | QClaw（千爪） | `~/.qclaw/skills/` |
| Lobster | EasyClaw（简爪） | `~/.easyclaw/skills/` |
| Lobster | EasyClaw V2 | `~/.easyclaw-20260322-01/skills/` |
| Lobster | AutoClaw | `~/.openclaw-autoclaw/skills/` |
| Lobster | WorkBuddy（打工搭子） | `~/.workbuddy/skills-marketplace/skills/` |
| Central | 中央技能库 | `~/.agents/skills/` |

也可以在 Settings 中添加自定义平台。

## 隐私与安全

- **本地优先** — 元数据、集合、扫描结果、设置和 AI explanation 缓存都保存在 `~/.skill-link/db.sqlite` 或你自己管理的本地 skill 目录中。
- **无遥测** — 应用不包含分析、崩溃上报或使用追踪。
- **网络访问由功能触发** — 只有在你显式使用 Skill Market 同步/下载、skill.sh 搜索/安装、GitHub 导入或 AI explanation 时才会发起外部请求。
- **凭据仅本地存储** — GitHub PAT 和 AI API key 会保存在本地 SQLite settings 表中，应用本身不提供静态加密。
- 不要在 issue、PR、截图或日志里公开真实密钥。

## 技术栈

| 层 | 技术 |
|----|------|
| 桌面框架 | Tauri v2 |
| 前端 | React 19、TypeScript、Tailwind CSS 4 |
| UI 组件 | shadcn/ui、Lucide icons |
| 状态管理 | Zustand |
| Markdown | react-markdown |
| 国际化 | react-i18next、i18next-browser-languagedetector |
| 主题 | Catppuccin 4 种风格 |
| 后端 | Rust（serde、sqlx、chrono、uuid） |
| 数据库 | SQLite via sqlx（WAL 模式） |
| 路由 | react-router-dom v7 |

## 开发

### 前置依赖

- [Node.js](https://nodejs.org/)（LTS）
- [pnpm](https://pnpm.io/)
- [Rust toolchain](https://rustup.rs/)（stable）
- Tauri v2 系统依赖：<https://v2.tauri.app/start/prerequisites/>

### 安装依赖

```bash
pnpm install
```

### 启动开发环境

```bash
pnpm tauri dev
```

Vite 开发服务器默认使用 `24200` 端口。

### 验证命令

```bash
pnpm test
pnpm typecheck
pnpm lint
cd src-tauri && cargo test
cd src-tauri && cargo clippy -- -D warnings
```

## 项目结构

```text
skill-link/
├── src/                        # React 前端
│   ├── components/             # UI 组件
│   ├── i18n/                   # 语言文件和 i18n 配置
│   ├── lib/                    # 前端工具函数
│   ├── pages/                  # 路由页面
│   ├── stores/                 # Zustand stores
│   ├── test/                   # Vitest + RTL 测试
│   └── types/                  # 共享 TypeScript 类型
├── src-tauri/                  # Rust 后端
│   └── src/
│       ├── commands/           # Tauri IPC 处理器
│       ├── db.rs               # SQLite schema、迁移、查询
│       ├── lib.rs              # Tauri 应用初始化
│       └── main.rs             # 桌面入口
├── public/                     # 静态资源
├── CHANGELOG.md                # 英文更新日志
├── CHANGELOG.zh.md             # 中文更新日志
└── release-notes/              # GitHub release notes
```

## 数据库

SQLite 数据库位于 `~/.skill-link/db.sqlite`，首次启动时会自动初始化。

## 更新日志

- 英文：[CHANGELOG.md](CHANGELOG.md)
- 中文：[CHANGELOG.zh.md](CHANGELOG.zh.md)

## 参与贡献

开发环境、验证命令和 PR 约定见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 安全报告

漏洞反馈和数据处理说明见 [SECURITY.md](SECURITY.md)。

## 许可证

本项目使用 Apache License 2.0，详见 [LICENSE](LICENSE)。
