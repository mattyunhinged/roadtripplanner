import type { AIProviderId } from '../../types';

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CompleteOptions {
  messages: AIMessage[];
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  onToken?: (token: string) => void;
}

export interface AIProvider {
  id: AIProviderId;
  validate(apiKey: string, model: string): Promise<{ valid: boolean; error?: string }>;
  complete(apiKey: string, model: string, options: CompleteOptions): Promise<string>;
  stream(apiKey: string, model: string, options: CompleteOptions): Promise<string>;
}

async function postJSON<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as T & { error?: string; valid?: boolean };
  if (!response.ok) {
    throw new Error((data as { error?: string }).error || `Request failed (${response.status})`);
  }
  return data;
}

async function streamComplete(
  provider: AIProviderId,
  apiKey: string,
  model: string,
  options: CompleteOptions,
): Promise<string> {
  const response = await fetch('/api/ai/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider,
      apiKey,
      model,
      messages: options.messages,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      jsonMode: options.jsonMode,
      stream: true,
    }),
  });

  if (!response.ok || !response.body) {
    const text = await response.text();
    throw new Error(text || 'Streaming failed');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let full = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6).trim();
      if (payload === '[DONE]') continue;
      try {
        const parsed = JSON.parse(payload) as { content?: string; error?: string };
        if (parsed.error) throw new Error(parsed.error);
        if (parsed.content) {
          full += parsed.content;
          options.onToken?.(parsed.content);
        }
      } catch (error) {
        if (error instanceof Error && error.message !== 'Unexpected end of JSON input') {
          if ((error as Error).message.includes('{') === false) throw error;
        }
      }
    }
  }

  return full;
}

class OpenAIProvider implements AIProvider {
  id: AIProviderId = 'openai';

  async validate(apiKey: string, model: string) {
    try {
      const data = await postJSON<{ valid: boolean; error?: string }>('/api/ai/validate', {
        provider: 'openai',
        apiKey,
        model,
      });
      return { valid: !!data.valid, error: data.error };
    } catch (error) {
      return { valid: false, error: error instanceof Error ? error.message : 'Validation failed' };
    }
  }

  async complete(apiKey: string, model: string, options: CompleteOptions) {
    if (options.onToken) {
      return this.stream(apiKey, model, options);
    }
    const data = await postJSON<{ content: string }>('/api/ai/complete', {
      provider: 'openai',
      apiKey,
      model,
      messages: options.messages,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      jsonMode: options.jsonMode,
      stream: false,
    });
    return data.content;
  }

  stream(apiKey: string, model: string, options: CompleteOptions) {
    return streamComplete('openai', apiKey, model, options);
  }
}

class AnthropicProvider implements AIProvider {
  id: AIProviderId = 'anthropic';

  async validate(apiKey: string, model: string) {
    try {
      const data = await postJSON<{ valid: boolean; error?: string }>('/api/ai/validate', {
        provider: 'anthropic',
        apiKey,
        model,
      });
      return { valid: !!data.valid, error: data.error };
    } catch (error) {
      return { valid: false, error: error instanceof Error ? error.message : 'Validation failed' };
    }
  }

  async complete(apiKey: string, model: string, options: CompleteOptions) {
    if (options.onToken) {
      return this.stream(apiKey, model, options);
    }
    const data = await postJSON<{ content: string }>('/api/ai/complete', {
      provider: 'anthropic',
      apiKey,
      model,
      messages: options.messages,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      jsonMode: options.jsonMode,
      stream: false,
    });
    return data.content;
  }

  stream(apiKey: string, model: string, options: CompleteOptions) {
    return streamComplete('anthropic', apiKey, model, options);
  }
}

const providers: Record<AIProviderId, AIProvider> = {
  openai: new OpenAIProvider(),
  anthropic: new AnthropicProvider(),
};

export function getAIProvider(id: AIProviderId): AIProvider {
  return providers[id];
}

export function extractJSON<T>(text: string): T {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence?.[1]) {
      return JSON.parse(fence[1].trim()) as T;
    }
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1)) as T;
    }
    throw new Error('AI returned invalid JSON');
  }
}
