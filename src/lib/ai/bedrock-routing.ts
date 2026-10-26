/**
 * Bare OpenAI model IDs target Mantle. Runtime requires inference profile IDs
 * for these models; preserve explicit profiles/ARNs on the existing Converse path.
 */
export function mantleEndpoint(model: string, region: string): string | null {
  if (!model.startsWith("openai.")) return null;
  const prefix = model.startsWith("openai.gpt-oss") ? "/v1" : "/openai/v1";
  return `https://bedrock-mantle.${region}.api.aws${prefix}`;
}
