import type { AiProvider, AiSettings } from "../../lib/prep-contract";

/** A provider switch starts a new draft so credentials cannot follow another host. */
export function switchProviderDraft(
  draft: AiSettings,
  provider: AiProvider,
): AiSettings {
  if (draft.provider === provider) return draft;
  return {
    provider,
    model: "",
    baseUrl: provider === "CometAPI" ? "https://api.cometapi.com/v1" : "",
    region: "us-west-2",
    authMode: "default",
    apiKey: "",
    bedrockApiKey: "",
    hasApiKey: false,
    hasBedrockApiKey: false,
    configured: false,
  };
}
