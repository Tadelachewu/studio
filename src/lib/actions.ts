"use server";

import { contextualGuidance, type ContextualGuidanceInput } from "@/ai/flows/contextual-guidance";

export async function getAiHint(input: ContextualGuidanceInput): Promise<string> {
  try {
    const { hint } = await contextualGuidance(input);
    return hint;
  } catch (error) {
    console.error("Error getting AI hint:", error);
    return "Could not load hint.";
  }
}
