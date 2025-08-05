// contextual-guidance.ts
'use server';

/**
 * @fileOverview This file defines a Genkit flow for providing contextual hints to users interacting with a USSD menu.
 *
 * - contextualGuidance - A function that takes the user's previous input and the current screen as input and returns a contextual hint.
 * - ContextualGuidanceInput - The input type for the contextualGuidance function.
 * - ContextualGuidanceOutput - The return type for the contextualGuidance function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ContextualGuidanceInputSchema = z.object({
  userInput: z.string().describe('The user input.'),
  currentScreen: z.string().describe('The current screen in the USSD menu.'),
});

export type ContextualGuidanceInput = z.infer<typeof ContextualGuidanceInputSchema>;

const ContextualGuidanceOutputSchema = z.object({
  hint: z.string().describe('A contextual hint for the user.'),
});

export type ContextualGuidanceOutput = z.infer<typeof ContextualGuidanceOutputSchema>;

export async function contextualGuidance(input: ContextualGuidanceInput): Promise<ContextualGuidanceOutput> {
  return contextualGuidanceFlow(input);
}

const contextualGuidancePrompt = ai.definePrompt({
  name: 'contextualGuidancePrompt',
  input: {schema: ContextualGuidanceInputSchema},
  output: {schema: ContextualGuidanceOutputSchema},
  prompt: `You are a USSD menu assistant that provides contextual hints to users based on their previous actions and current screen.

  Based on the user's input and the current screen, determine the next logical step the user might want to take and provide a short, helpful hint to guide them.

  User Input: {{{userInput}}}
  Current Screen: {{{currentScreen}}}

  Hint:`,
});

const contextualGuidanceFlow = ai.defineFlow(
  {
    name: 'contextualGuidanceFlow',
    inputSchema: ContextualGuidanceInputSchema,
    outputSchema: ContextualGuidanceOutputSchema,
  },
  async input => {
    const {output} = await contextualGuidancePrompt(input);
    return {
      hint: output?.hint || 'No hint available.',
    };
  }
);
