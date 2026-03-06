import OpenAI from "openai";

export const openai = new OpenAI({
  apiKey: process.env.AIHUBMIX_API_KEY || "",
  baseURL: "https://aihubmix.com/v1",
});

export const MODEL = "gemini-3.1-pro-preview";
