/** Explicit allow-list: unknown providers must never fall through to cloud execution. */
export const LOCAL_RESEARCH_PLATFORMS = ["codex", "claude", "cursor", "gemini", "opencode", "deepseek"] as const;
export type SPLocalPlatform = typeof LOCAL_RESEARCH_PLATFORMS[number];
export type SPPlatform = SPLocalPlatform | "sciencepal";
export const isLocalResearchPlatform = (v: unknown): v is SPLocalPlatform => LOCAL_RESEARCH_PLATFORMS.includes(v as SPLocalPlatform);
export const isResearchPlatform = (v: unknown): v is SPPlatform => v === "sciencepal" || isLocalResearchPlatform(v);
export const researchPlatformName = (v: unknown): string => ({codex:"Codex",claude:"Claude",cursor:"Cursor",gemini:"Gemini",opencode:"OpenCode",deepseek:"DeepSeek",sciencepal:"SciencePAL"})[v as SPPlatform] ?? "未知平台";
