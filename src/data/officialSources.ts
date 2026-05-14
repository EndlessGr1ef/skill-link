// ─── Types ───────────────────────────────────────────────────────────────────

export type SkillTag =
  | "frontend"
  | "backend"
  | "mobile"
  | "design"
  | "database"
  | "devops"
  | "security"
  | "testing"
  | "ai-ml"
  | "workflow"
  | "best-practices";

export interface RecommendedSkill {
  name: string;
  description: string;
  publisher: string;
  repoFullName: string;
  tags: SkillTag[];
  downloadUrl: string;
}

// ─── Tag Labels ──────────────────────────────────────────────────────────────

export const TAG_LABELS: Record<SkillTag, { zh: string; en: string }> = {
  frontend: { zh: "前端开发", en: "Frontend" },
  backend: { zh: "后端开发", en: "Backend" },
  mobile: { zh: "移动开发", en: "Mobile" },
  design: { zh: "UI/UX 设计", en: "Design" },
  database: { zh: "数据库", en: "Database" },
  devops: { zh: "DevOps", en: "DevOps" },
  security: { zh: "安全", en: "Security" },
  testing: { zh: "测试/监控", en: "Testing" },
  "ai-ml": { zh: "AI/ML", en: "AI/ML" },
  workflow: { zh: "工作流", en: "Workflow" },
  "best-practices": { zh: "最佳实践", en: "Best Practices" },
};

// ─── Recommended Skills (curated, with tags) ─────────────────────────────────

export const RECOMMENDED_SKILLS: RecommendedSkill[] = [
  {
    name: "frontend-design",
    description: "Create distinctive, production-grade frontend interfaces with high design quality. Avoids generic AI aesthetics with bold, intentional design choices",
    publisher: "Anthropic",
    repoFullName: "anthropics/skills",
    tags: ["frontend", "design"],
    downloadUrl: "https://raw.githubusercontent.com/anthropics/skills/main/skills/frontend-design/SKILL.md",
  },
  {
    name: "redis-development",
    description: "Redis performance optimization and best practices — data structures, Query Engine, vector search, semantic caching",
    publisher: "Redis",
    repoFullName: "redis/agent-skills",
    tags: ["database"],
    downloadUrl: "https://raw.githubusercontent.com/redis/agent-skills/main/skills/redis-development/SKILL.md",
  },
  {
    name: "auth0-quickstart",
    description: "Auth0 authentication and authorization — SSO, MFA, user management, framework-specific SDK integration",
    publisher: "Auth0",
    repoFullName: "auth0/agent-skills",
    tags: ["security"],
    downloadUrl: "https://raw.githubusercontent.com/auth0/agent-skills/main/plugins/auth0/skills/auth0-quickstart/SKILL.md",
  },
  {
    name: "find-bugs",
    description: "Find bugs, security vulnerabilities, and code quality issues in local branch changes",
    publisher: "Sentry",
    repoFullName: "getsentry/skills",
    tags: ["testing", "best-practices"],
    downloadUrl: "https://raw.githubusercontent.com/getsentry/skills/main/skills/find-bugs/SKILL.md",
  },
  {
    name: "figma-implement-design",
    description: "Translates Figma designs into production-ready application code with 1:1 visual fidelity",
    publisher: "Figma",
    repoFullName: "figma/mcp-server-guide",
    tags: ["design"],
    downloadUrl: "https://raw.githubusercontent.com/figma/mcp-server-guide/main/skills/figma-implement-design/SKILL.md",
  },
  {
    name: "karpathy-guidelines",
    description: "Behavioral guidelines to reduce common LLM coding mistakes — think before coding, simplicity first, surgical changes, goal-driven execution",
    publisher: "Multica AI",
    repoFullName: "multica-ai/andrej-karpathy-skills",
    tags: ["best-practices"],
    downloadUrl: "https://raw.githubusercontent.com/multica-ai/andrej-karpathy-skills/main/skills/karpathy-guidelines/SKILL.md",
  },
  {
    name: "skill-creator",
    description: "Create new skills, modify and improve existing skills, and measure skill performance with evals and benchmarks",
    publisher: "Anthropic",
    repoFullName: "anthropics/skills",
    tags: ["workflow"],
    downloadUrl: "https://raw.githubusercontent.com/anthropics/skills/main/skills/skill-creator/SKILL.md",
  },
  {
    name: "ui-ux-pro-max",
    description: "67 UI styles, 161 color palettes, 57 font pairings, 25 charts, 15 tech stacks, 161 industry reasoning rules — AI-powered design system generation for production-grade interfaces",
    publisher: "Next Level Builder",
    repoFullName: "nextlevelbuilder/ui-ux-pro-max-skill",
    tags: ["design", "frontend"],
    downloadUrl: "https://raw.githubusercontent.com/nextlevelbuilder/ui-ux-pro-max-skill/main/.claude/skills/ui-ux-pro-max/SKILL.md",
  },
  {
    name: "planning-with-files",
    description: "File-based planning with task_plan.md, findings.md, and progress.md — organize and track progress on complex multi-step tasks with automatic session recovery",
    publisher: "Othman Adi",
    repoFullName: "OthmanAdi/planning-with-files",
    tags: ["workflow"],
    downloadUrl: "https://raw.githubusercontent.com/OthmanAdi/planning-with-files/master/skills/planning-with-files/SKILL.md",
  },
];

// ─── All Tags (auto-derived from RECOMMENDED_SKILLS) ──────────────────────────

export const ALL_TAGS: SkillTag[] = [...new Set(RECOMMENDED_SKILLS.flatMap((s) => s.tags))];
