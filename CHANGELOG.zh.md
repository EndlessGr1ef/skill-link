# 更新日志

本项目的所有重要变更都将记录在此文件中。

## 0.1.0 - 2026-04-27

> **Skill Link** 是基于 [iamzhihuix](https://github.com/iamzhihuix) 的 [skills-manage](https://github.com/iamzhihuix/skills-manage) 项目的首个二次开发版本。这是一个硬分叉（hard fork），带来了全新的视觉风格、市场集成和扩展的 AI 提供商支持。

### 品牌与标识

- 将应用名称从 `skills-manage` 重命名为 **Skill Link**，更新 README 和文档。
- 在 README 和 CLAUDE.md 中添加对上游项目 `iamzhihuix/skills-manage` 的致谢。
- 基于新的 1024×1024 源文件重新生成所有平台应用图标（macOS `.icns`、Windows `.ico`、Linux PNG、Android mipmap、iOS AppIcon）。

### 主题与外观

- **Obsidian 亮色主题**：新增亮色主题，采用暖白底色（`#ffffff`）、浅灰卡片（`#f6f8fa`）和紫色调强调色（`#8250df`），灵感来自 Obsidian 应用。
- **字体配置**：在设置 → 关于中新增字体选择器，提供三个选项：
  - **Geist** — 现代可变无衬线字体
  - **JetBrains Mono** — 等宽 UI 字体
  - **系统字体** — 操作系统原生字体（默认）
- 暗色模式默认主题从 Catppuccin Mocha 改为 **Obsidian Light**。
- 默认字体从 JetBrains Mono 改为**系统字体**。
- 设置页 UI 标签 "主题风格" 统一为**"主题"**。
- 修复全局字体继承问题（包括侧边栏）：通过在 `<html>` 元素上直接设置 `font-family` 实现，因为 Tailwind v4 的实用类在构建时内联了字体栈，无法通过 CSS 变量覆盖。

### 市场与技能发现

- **skills.sh 集成**：替换原有市场实现，完整集成 [skill.sh](https://skill.sh) 的浏览、搜索和安装流程。
- **技能详情页**：新增丰富的技能详情体验，包含：
  - 可浏览的文件树，支持语法高亮预览
  - GitHub Star 数量和仓库元数据
  - AI 生成的技能说明（支持 frontmatter 上下文）
- **GitHub 仓库导入**：支持直接从 GitHub 仓库导入技能：
  - 导入前预览
  - 镜像回退重试
  - 通过 PAT 进行可选的认证请求
  - 导入后的平台安装流程

### AI 提供商设置

- **按提供商独立配置**：每个 AI 提供商（Claude、GLM、MiniMax、Kimi、DeepSeek、自定义）现在拥有独立设置。
- **协议选择器**：为自定义端点选择 OpenAI 或 Anthropic API 协议。
- **连接测试**：新增"测试连接"按钮，带加载状态和结果反馈。
- **懒保存**：设置项在失焦/变更时自动保存，无需显式点击保存。
- **国际化**：所有 AI 提供商标签和描述均已完整翻译。

### 技能管理

- **可浏览文件树**：在技能详情抽屉和页面中新增文件树视图，可查看技能内每个文件并支持语法高亮预览。
- **自定义扫描目录安装**：修复了允许直接从平台视图安装自定义扫描目录技能的问题。

### 修复

- 将 `--hover-bg` 颜色变量从全局 `:root` 移至各主题块内，确保所有主题的颜色映射正确。
- 修复 AI 提供商设置中的竞态条件和 URL 一致性问题。
- 修复 AI 设置标签中的 i18n 键不匹配问题。
