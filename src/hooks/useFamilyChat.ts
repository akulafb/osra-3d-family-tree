// src/hooks/useFamilyChat.ts

import { useState, useCallback } from 'react';
import { Message, callLLM } from '../utils/llmClient';
import { formatFamilyData } from '../utils/familyContext';
import { useFamilyData } from './useFamilyData';

export function useFamilyChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { graphData } = useFamilyData();

  const sendMessage = useCallback(async (userQuery: string) => {
    if (!userQuery.trim()) return;

    setIsLoading(true);
    setError(null);

    // Add user message to UI
    const userMessage: Message = { role: 'user', content: userQuery };
    setMessages(prev => [...prev, userMessage]);

    try {
      // Prepare context from family data
      const familyContext = graphData 
        ? formatFamilyData(graphData.nodes, graphData.links)
        : 'Family data is currently unavailable.';

      const systemPrompt: Message = {
        role: 'system',
        content: `You are an expert Family Tree Analyst. Use the provided family data to answer questions with 100% accuracy.

REASONING PROTOCOL:
1. DATA SCOPE: Use the "FAMILY PROFILES" provided. Each profile lists parents, siblings, spouses, and children.
2. COUSINS: 
   - A person's cousins are the children of their parents' siblings.
   - Trace: Subject -> Parents -> Parents' Siblings -> Their Children.
3. MATERNAL VS PATERNAL: 
   - "Maternal" means tracing through the Mother (usually female).
   - "Paternal" means tracing through the Father (usually male).
   - If gender is not explicit, use names to infer (e.g., Baha = Mother, Basel = Father).
4. ROBUSTNESS: 
   - Always check BOTH parents for siblings to find all cousins.
   - Blood relationships cross "Family Clusters".
5. COUNTING: List names first, categorized by side (Maternal/Paternal), then give the total.
6. OUTPUT STYLE: 
   - Use **Markdown** for better readability.
   - **Bold** names of family members.
   - Use bulleted lists for groups of relatives.
   - Use headers (e.g., ### Maternal Side) to separate different lineages if applicable.
   - Be as concise as possible, but thorough. Accuracy is paramount.
   - If asked to count, list the names first, then provide the total.
   - IMPORTANT: Never show your reasoning process. Only output the final answer. No step-by-step workthrough.
   - Keep the tone helpful and friendly.
7. NAME AMBIGUITY: Distinguish between people with the same name using their family cluster or specific relatives.
8. INTERPRETATION: "Fahd" refers to "Fahd Badran".
9. CLARIFICATION: In case of ambiguity, ask the user to provide more information (e.g. "which Nada are you referring to: Okasha or Badran")

Family Data:
${familyContext}`
      };

      // We only send the last few messages to keep the context window manageable if needed, 
      // but here we send the whole history for simplicity since it's a small chat.
      const llmResponse = await callLLM([systemPrompt, ...messages, userMessage]);

      const assistantMessage: Message = { role: 'assistant', content: llmResponse };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      console.error('Chat error:', err);
      setError(err instanceof Error ? err.message : 'Failed to get a response from the AI.');
    } finally {
      setIsLoading(false);
    }
  }, [graphData, messages]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearChat
  };
}
