import OpenAI from "openai";

// 支持两种 API 提供商：
// 1. AiHubMix（默认）— 设置 AIHUBMIX_API_KEY
// 2. YesCode       — 设置 YESCODE_API_KEY
const apiKey =
  process.env.AIHUBMIX_API_KEY ||
  process.env.YESCODE_API_KEY ||
  "";

const baseURL = process.env.YESCODE_API_KEY
  ? "https://co.yes.vg/team/v1"
  : "https://aihubmix.com/v1";

export const openai = new OpenAI({ apiKey, baseURL });

// 可通过环境变量 MODEL 切换模型
// 推荐: gemini-3.1-pro-preview, claude-sonnet-4-5, gpt-5.4
export const MODEL = process.env.MODEL || "gemini-3.1-pro-preview";
