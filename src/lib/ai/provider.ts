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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 180_000);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = (await response.json()) as T & { error?: string; valid?: boolean };
    if (!response.ok) {
      throw new Error((data as { error?: string }).error || `Request failed (${response.status})`);
    }
    return data;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('AI request timed out after 3 minutes. Try Fast mode or a shorter trip.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
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

/** Remove trailing commas before } or ] without touching string contents. */
function removeTrailingCommas(text: string): string {
  let out = '';
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      out += ch;
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }
    if (ch === ',') {
      let j = i + 1;
      while (j < text.length && /\s/.test(text[j])) j++;
      if (text[j] === '}' || text[j] === ']') continue; // drop the comma
    }
    out += ch;
  }
  return out;
}

/** Repair keys/quotes only outside of string values. */
function repairStructuralIssues(text: string): string {
  let out = text.replace(/^\uFEFF/, '');
  // Unquoted keys: { title: "x" } -> { "title": "x" }
  out = out.replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:/g, '$1"$2":');
  // Single-quoted string values
  out = out.replace(/:\s*'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_m, inner: string) => {
    const esc = inner.replace(/"/g, '\\"');
    return `: "${esc}"`;
  });
  return removeTrailingCommas(out);
}

/** Close any open strings/brackets so a truncated response can still parse. */
function closeOpenStructures(text: string): string {
  let inString = false;
  let escaped = false;
  const stack: string[] = [];

  for (const ch of text) {
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{' || ch === '[') stack.push(ch);
    else if (ch === '}' || ch === ']') stack.pop();
  }

  let out = text;
  if (inString) out += '"';
  out = out.replace(/,\s*$/, '');
  for (let i = stack.length - 1; i >= 0; i--) {
    out += stack[i] === '{' ? '}' : ']';
  }
  return out;
}

/** Best-effort salvage of a truncated JSON object (e.g. token cap hit mid-stream). */
function salvageTruncatedJSON(text: string): string | null {
  const start = text.indexOf('{');
  if (start < 0) return null;
  let candidate = text.slice(start);

  for (let attempt = 0; attempt < 60; attempt++) {
    const closed = removeTrailingCommas(closeOpenStructures(candidate));
    try {
      JSON.parse(closed);
      return closed;
    } catch {
      // Trim back to the previous structural boundary and retry.
      const cut = Math.max(
        candidate.lastIndexOf(','),
        candidate.lastIndexOf('{'),
        candidate.lastIndexOf('['),
      );
      if (cut <= 0) return null;
      candidate = candidate.slice(0, cut);
    }
  }
  return null;
}

function parseCandidates(text: string): string[] {
  const stripped = stripCodeFences(text);
  const candidates: string[] = [stripped];

  const balanced = extractBalancedObject(stripped);
  if (balanced) candidates.push(balanced);

  const first = stripped.indexOf('{');
  const last = stripped.lastIndexOf('}');
  if (first >= 0 && last > first) {
    candidates.push(stripped.slice(first, last + 1));
  }

  // Raw candidates FIRST (valid JSON must never be "repaired"), then repaired versions.
  const ordered = [
    ...candidates,
    ...candidates.map(removeTrailingCommas),
    ...candidates.map(repairStructuralIssues),
  ];
  return [...new Set(ordered.filter(Boolean))];
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

  // Last resort: the response was likely cut off mid-generation.
  const salvaged = salvageTruncatedJSON(stripCodeFences(text));
  if (salvaged) {
    return JSON.parse(salvaged) as T;
  }

  const snippet = text.trim().slice(0, 180).replace(/\s+/g, ' ');
  const detail = lastError?.message || 'unknown parse error';
  throw new Error(
    `AI returned invalid JSON (${detail}). Preview: ${snippet}${text.trim().length > 180 ? '…' : ''}`,
  );
}
