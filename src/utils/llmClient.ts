// src/utils/llmClient.ts

export type Message = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

const LLM_MODE = import.meta.env.VITE_LLM_MODE || 'cloud';
const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;
const OLLAMA_URL = 'http://127.0.0.1:11434/api/chat';

export async function callLLM(messages: Message[]): Promise<string> {
  if (LLM_MODE === 'cloud') {
    return callOpenRouter(messages);
  } else {
    return callOllama(messages);
  }
}

async function callOpenRouter(messages: Message[]): Promise<string> {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OpenRouter API key is missing. Set VITE_OPENROUTER_API_KEY.');
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': '3D Family Tree Chat',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'x-ai/grok-4-fast', 
        messages: messages
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`OpenRouter error: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (err) {
    console.error('Error calling OpenRouter:', err);
    throw err;
  }
}

async function callOllama(messages: Message[]): Promise<string> {
  try {
    const response = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'qwen2.5-coder:7b',
        messages: messages,
        stream: false
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.message.content;
  } catch (err) {
    console.error('Error calling Ollama:', err);
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`Ollama connection failed (${detail}). Ensure Ollama is running on localhost:11434 with OLLAMA_ORIGINS="*"`);
  }
}
