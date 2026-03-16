/**
 * Robust JSON extraction from LLM output.
 *
 * LLMs frequently wrap JSON in markdown fences, add preamble/postamble text,
 * or produce minor formatting issues. This module handles all common cases.
 */

/**
 * Extract and parse a JSON object from potentially messy LLM output.
 * Tries multiple strategies in order of strictness:
 *   1. Direct parse (already clean JSON)
 *   2. Strip markdown code fences then parse
 *   3. Find the outermost `{ ... }` via bracket matching and parse
 *   4. Fix common JSON errors (trailing commas, unescaped newlines) then retry
 *
 * Throws if all strategies fail.
 */
export function extractAndParseJSON(raw: string): unknown {
  const trimmed = raw.trim();

  // Strategy 1: direct parse
  try {
    return JSON.parse(trimmed);
  } catch {
    // continue
  }

  // Strategy 2: strip markdown code fences
  const fenceStripped = trimmed
    .replace(/^```+(?:json|JSON)?\s*\n?/, "")
    .replace(/\n?\s*```+\s*$/, "")
    .trim();

  try {
    return JSON.parse(fenceStripped);
  } catch {
    // continue
  }

  // Strategy 3: bracket-matching to extract outermost JSON object
  const extracted = extractOutermostObject(fenceStripped);
  if (extracted) {
    try {
      return JSON.parse(extracted);
    } catch {
      // Try fixing common issues on the extracted string
      const fixed = fixCommonJSONErrors(extracted);
      try {
        return JSON.parse(fixed);
      } catch {
        // continue
      }
    }
  }

  // Strategy 4: try fixing on the full fence-stripped text
  const fixed = fixCommonJSONErrors(fenceStripped);
  try {
    return JSON.parse(fixed);
  } catch {
    // All strategies exhausted
  }

  throw new Error("Failed to extract valid JSON from LLM output");
}

/**
 * Use bracket matching to find the outermost `{ ... }` block.
 * This is more reliable than indexOf/lastIndexOf because the LLM might
 * output text after the JSON closing brace.
 */
function extractOutermostObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (ch === "\\") {
      escape = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }

  // Unbalanced — return from start to last `}` as fallback
  const lastBrace = text.lastIndexOf("}");
  if (lastBrace > start) {
    return text.slice(start, lastBrace + 1);
  }

  return null;
}

/**
 * Fix common JSON formatting errors that LLMs produce:
 * - Trailing commas before } or ]
 * - Unescaped newlines inside string values
 * - Single-line // comments
 */
function fixCommonJSONErrors(json: string): string {
  let fixed = json;

  // Remove single-line comments (not inside strings — best effort)
  fixed = fixed.replace(/^\s*\/\/.*$/gm, "");

  // Remove trailing commas: ,] or ,}
  fixed = fixed.replace(/,\s*([\]}])/g, "$1");

  // Fix unescaped newlines inside strings (between unescaped quotes)
  // This is a best-effort approach: replace literal newlines with \n
  // only when they appear to be inside a JSON string value.
  fixed = fixed.replace(/"([^"\\]*(?:\\.[^"\\]*)*)"/g, (match) => {
    return match.replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t");
  });

  return fixed;
}
