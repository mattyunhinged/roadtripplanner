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
    let message = 'Streaming failed';
    try {
      const data = (await response.json()) as { error?: string };
      message = data.error || message;
    } catch {
      const text = await response.text();
      if (text) message = text.slice(0, 240);
    }
    throw new Error(message);
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
      if (!payload || payload === '[DONE]') continue;
      try {
        const parsed = JSON.parse(payload) as { content?: string; error?: string };
        if (parsed.error) throw new Error(parsed.error);
        if (parsed.content) {
          full += parsed.content;
          options.onToken?.(parsed.content);
        }
      } catch (error) {
        // Fatal only for explicit upstream errors; ignore malformed/partial SSE chunks.
        if (error instanceof Error && !(error instanceof SyntaxError)) {
          throw error;
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

function stripCodeFences(text: string): string {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return fence?.[1]?.trim() || text.trim();
}

function normalizeJSONText(text: string): string {
  let out = text.trim();
  out = out.replace(/^\uFEFF/, '');
  out = out.replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'");
  out = out.replace(/^\s*\/\/.*$/gm, '');
  out = out.replace(/,\s*([}\]])/g, '$1');
  return out;
}

function extractBalancedObject(text: string): string | null {
  const start = text.indexOf('{');
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }

  return null;
}

function repairCommonJSONIssues(text: string): string {
  let out = normalizeJSONText(text);
  // Unquoted keys: { title: "x" } -> { "title": "x" }
  out = out.replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:/g, '$1"$2":');
  // Single-quoted string values
  out = out.replace(/:\s*'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_m, inner: string) => {
    const escaped = inner.replace(/"/g, '\\"');
    return `: "${escaped}"`;
  });
  return out;
}

function parseCandidates(text: string): string[] {
  const stripped = stripCodeFences(text);
  const balanced = extractBalancedObject(stripped);
  const candidates = [stripped];
  if (balanced) candidates.push(balanced);

  const first = stripped.indexOf('{');
  const last = stripped.lastIndexOf('}');
  if (first >= 0 && last > first) {
    candidates.push(stripped.slice(first, last + 1));
  }

  const repaired = candidates.flatMap((c) => [normalizeJSONText(c), repairCommonJSONIssues(c)]);
  return [...new Set(repaired.filter(Boolean))];
}

export function extractJSON<T>(text: string): T {
  if (!text || !text.trim()) {
    throw new Error('AI returned an empty response. Try again.');
  }

  const candidates = parseCandidates(text);
  let lastError: Error | null = null;

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as T;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  const snippet = text.trim().slice(0, 180).replace(/\s+/g, ' ');
  const detail = lastError?.message || 'unknown parse error';
  throw new Error(
    `AI returned invalid JSON (${detail}). Preview: ${snippet}${text.trim().length > 180 ? '…' : ''}`,
  );
}
