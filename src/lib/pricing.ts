/**
 * Approximate per-model USD prices, sampled from public list prices in
 * 2025-2026. Local single-user use case — meant for "ballpark cost" display,
 * not billing. When a model is unknown, returns null and the UI hides cost.
 *
 * All prices are USD per 1M tokens.
 */

interface ModelPrice {
  input: number;
  output: number;
}

const PRICES: Record<string, ModelPrice> = {
  // OpenAI
  "gpt-5.4": { input: 2.5, output: 10.0 },
  "gpt-4o": { input: 2.5, output: 10.0 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },

  // Anthropic
  "claude-sonnet-4-5": { input: 3.0, output: 15.0 },
  "claude-sonnet-4-6": { input: 3.0, output: 15.0 },
  "claude-opus-4-7": { input: 15.0, output: 75.0 },
  "claude-haiku-4-5-20251001": { input: 1.0, output: 5.0 },

  // Google
  "gemini-3.1-pro-preview": { input: 1.25, output: 5.0 },
  "gemini-3.1-flash-lite-preview": { input: 0.075, output: 0.3 },

  // Other
  "qwen3.5-27b": { input: 0.4, output: 1.2 },
  "deepseek-v3.2": { input: 0.27, output: 1.1 },
};

export function priceForModel(model: string): ModelPrice | null {
  return PRICES[model] ?? null;
}

export function estimateCostUSD(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number | null {
  const price = priceForModel(model);
  if (!price) return null;
  return (promptTokens * price.input + completionTokens * price.output) / 1_000_000;
}
