import { pinyin } from "pinyin-pro";

/**
 * Generate searchable pinyin representations for a Chinese string.
 * Returns: full pinyin (no spaces), first-letter initials, and the original string.
 * Example: "张三丰" → ["zhangsanfeng", "zsf", "张三丰"]
 */
export function getPinyinVariants(text: string): string[] {
  if (!text) return [];

  // Full pinyin without tone marks, no separator
  const full = pinyin(text, { toneType: "none", type: "array" })
    .join("")
    .toLowerCase();

  // First letter of each character's pinyin
  const initials = pinyin(text, { pattern: "first", toneType: "none", type: "array" })
    .join("")
    .toLowerCase();

  return [full, initials, text.toLowerCase()];
}
