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

  // Strategy 5: truncated JSON repair — close unclosed brackets/strings
  const repaired = repairTruncatedJSON(fenceStripped);
  if (repaired) {
    try {
      return JSON.parse(repaired);
    } catch {
      // continue
    }
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

/**
 * Attempt to repair truncated JSON by:
 * 1. Truncating back to the last complete key-value pair
 * 2. Closing any open strings, arrays, and objects
 *
 * This handles the common case where the LLM output exceeds
 * max_completion_tokens and gets cut off mid-sentence.
 */
function repairTruncatedJSON(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;

  let json = text.slice(start);

  // Remove any trailing incomplete string value:
  // Find the last complete key-value or array element by cutting back
  // to the last comma, closing bracket, or colon followed by a value.
  // Strategy: cut back to the last line that ends with a valid JSON delimiter.

  // First, close any open string: if we have an odd number of unescaped quotes,
  // trim back to the last complete quoted string.
  let inString = false;
  let lastSafePos = -1;
  let escape = false;
  const stack: string[] = []; // track open { and [

  for (let i = 0; i < json.length; i++) {
    const ch = json[i];

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

    if (ch === "{" || ch === "[") {
      stack.push(ch);
      lastSafePos = i;
    } else if (ch === "}" || ch === "]") {
      stack.pop();
      lastSafePos = i;
    } else if (ch === "," || ch === ":") {
      lastSafePos = i;
    }
  }

  // If we're in the middle of a string, cut back to just before the opening quote
  if (inString) {
    // Find the last unescaped opening quote
    let quotePos = json.length - 1;
    while (quotePos >= 0) {
      if (json[quotePos] === '"' && (quotePos === 0 || json[quotePos - 1] !== "\\")) {
        break;
      }
      quotePos--;
    }
    json = json.slice(0, quotePos) + '""';
  }

  // Trim trailing commas and whitespace
  json = json.replace(/,\s*$/, "");

  // Re-scan to count open brackets
  const closeStack: string[] = [];
  inString = false;
  escape = false;
  for (let i = 0; i < json.length; i++) {
    const ch = json[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\") { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{") closeStack.push("}");
    else if (ch === "[") closeStack.push("]");
    else if (ch === "}" || ch === "]") closeStack.pop();
  }

  // Close all open brackets in reverse order
  while (closeStack.length > 0) {
    json += closeStack.pop();
  }

  return json;
}
