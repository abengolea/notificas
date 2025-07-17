'use server';
/**
 * @fileOverview Summarizes the content of a message.
 *
 * - summarizeMessageContent - A function that summarizes the content of a message.
 * - SummarizeMessageContentInput - The input type for the summarizeMessageContent function.
 * - SummarizeMessageContentOutput - The return type for the summarizeMessageContent function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeMessageContentInputSchema = z.object({
  messageContent: z.string().describe('The content of the message to summarize.'),
});
export type SummarizeMessageContentInput = z.infer<typeof SummarizeMessageContentInputSchema>;

const SummarizeMessageContentOutputSchema = z.object({
  summary: z.string().describe('A brief summary of the message content.'),
});
export type SummarizeMessageContentOutput = z.infer<typeof SummarizeMessageContentOutputSchema>;

export async function summarizeMessageContent(input: SummarizeMessageContentInput): Promise<SummarizeMessageContentOutput> {
  return summarizeMessageContentFlow(input);
}

const prompt = ai.definePrompt({
  name: 'summarizeMessageContentPrompt',
  input: {schema: SummarizeMessageContentInputSchema},
  output: {schema: SummarizeMessageContentOutputSchema},
  prompt: `Summarize the following message content in a single sentence:\n\n{{{messageContent}}}`,
});

const summarizeMessageContentFlow = ai.defineFlow(
  {
    name: 'summarizeMessageContentFlow',
    inputSchema: SummarizeMessageContentInputSchema,
    outputSchema: SummarizeMessageContentOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
