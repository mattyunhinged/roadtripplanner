import express from 'express';
import cors from 'cors';

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

type Provider = 'openai' | 'anthropic';

interface AIRequestBody {
  provider: Provider;
  apiKey: string;
  model: string;
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  stream?: boolean;
}

function badRequest(res: express.Response, message: string) {
  return res.status(400).json({ error: message });
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'on-the-road-ai-proxy' });
});

app.post('/api/ai/validate', async (req, res) => {
  try {
    const { provider, apiKey, model } = req.body as {
      provider: Provider;
      apiKey: string;
      model?: string;
    };

    if (!provider || !apiKey) {
      return badRequest(res, 'provider and apiKey are required');
    }

    if (provider === 'openai') {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!response.ok) {
        const text = await response.text();
        return res.status(response.status).json({
          valid: false,
          error: parseProviderError(text, 'OpenAI key validation failed'),
        });
      }
      return res.json({ valid: true, provider: 'openai' });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: model || 'claude-sonnet-4-20250514',
        max_tokens: 16,
        messages: [{ role: 'user', content: 'Reply with OK' }],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({
        valid: false,
        error: parseProviderError(text, 'Anthropic key validation failed'),
      });
    }

    return res.json({ valid: true, provider: 'anthropic' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      valid: false,
      error: error instanceof Error ? error.message : 'Validation failed',
    });
  }
});

app.post('/api/ai/images', async (req, res) => {
  try {
    const { apiKey, prompt, size, quality, model } = req.body as {
      apiKey: string;
      prompt: string;
      size?: string;
      quality?: string;
      model?: string;
    };
    if (!apiKey || !prompt) {
      return badRequest(res, 'apiKey and prompt are required');
    }

    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model || 'gpt-image-1',
        prompt,
        n: 1,
        size: size || '1536x1024',
        quality: quality || 'high',
      }),
    });

    const data = (await response.json()) as {
      error?: { message?: string };
      data?: { b64_json?: string; url?: string; revised_prompt?: string }[];
    };

    if (!response.ok) {
      // Fallback to dall-e-3 if gpt-image-1 unavailable
      if (response.status === 404 || data.error?.message?.toLowerCase().includes('model')) {
        const fallback = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'dall-e-3',
            prompt: prompt.slice(0, 3900),
            n: 1,
            size: '1792x1024',
            quality: 'hd',
            response_format: 'b64_json',
          }),
        });
        const fallbackData = (await fallback.json()) as {
          error?: { message?: string };
          data?: { b64_json?: string; url?: string }[];
        };
        if (!fallback.ok) {
          return res.status(fallback.status).json({
            error: fallbackData.error?.message || 'Image generation failed',
          });
        }
        const img = fallbackData.data?.[0];
        return res.json({
          b64: img?.b64_json,
          url: img?.url,
          model: 'dall-e-3',
        });
      }
      return res.status(response.status).json({
        error: data.error?.message || 'Image generation failed',
      });
    }

    const img = data.data?.[0];
    return res.json({
      b64: img?.b64_json,
      url: img?.url,
      revisedPrompt: img?.revised_prompt,
      model: model || 'gpt-image-1',
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Image generation failed',
    });
  }
});

app.post('/api/ai/complete', async (req, res) => {
  try {
    const body = req.body as AIRequestBody;
    if (!body.provider || !body.apiKey || !body.model || !body.messages?.length) {
      return badRequest(res, 'provider, apiKey, model, and messages are required');
    }

    if (body.stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      if (body.provider === 'openai') {
        await streamOpenAI(body, res);
      } else {
        await streamAnthropic(body, res);
      }
      return;
    }

    if (body.provider === 'openai') {
      const content = await completeOpenAI(body);
      return res.json({ content });
    }

    const content = await completeAnthropic(body);
    return res.json({ content });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : 'AI request failed';
    return res.status(500).json({ error: message });
  }
});

function parseProviderError(text: string, fallback: string): string {
  try {
    const json = JSON.parse(text) as {
      error?: { message?: string };
      message?: string;
    };
    return json.error?.message || json.message || fallback;
  } catch {
    return text.slice(0, 240) || fallback;
  }
}

async function completeOpenAI(body: AIRequestBody): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${body.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: body.model,
      temperature: body.temperature ?? 0.7,
      max_tokens: body.maxTokens ?? 8000,
      messages: body.messages,
      ...(body.jsonMode ? { response_format: { type: 'json_object' } } : {}),
    }),
  });

  const data = (await response.json()) as {
    error?: { message?: string };
    choices?: { message?: { content?: string } }[];
  };

  if (!response.ok) {
    throw new Error(data.error?.message || 'OpenAI request failed');
  }

  return data.choices?.[0]?.message?.content || '';
}

function withAnthropicJsonPrefill(
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  jsonMode?: boolean,
) {
  if (!jsonMode) return messages;
  const hasAssistant = messages.some((m) => m.role === 'assistant');
  if (hasAssistant) return messages;
  return [...messages, { role: 'assistant' as const, content: '{' }];
}

async function completeAnthropic(body: AIRequestBody): Promise<string> {
  const system = body.messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  const messages = withAnthropicJsonPrefill(
    body.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role, content: m.content })),
    body.jsonMode,
  );

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': body.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: body.model,
      max_tokens: body.maxTokens ?? 8000,
      temperature: body.temperature ?? 0.7,
      system: system || undefined,
      messages,
    }),
  });

  const data = (await response.json()) as {
    error?: { message?: string };
    content?: { type: string; text?: string }[];
  };

  if (!response.ok) {
    throw new Error(data.error?.message || 'Anthropic request failed');
  }

  const text =
    data.content?.filter((c) => c.type === 'text').map((c) => c.text || '').join('') || '';
  return body.jsonMode && !text.trim().startsWith('{') ? `{${text}` : text;
}

async function streamOpenAI(body: AIRequestBody, res: express.Response) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${body.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: body.model,
      temperature: body.temperature ?? 0.7,
      max_tokens: body.maxTokens ?? 8000,
      messages: body.messages,
      stream: true,
      ...(body.jsonMode ? { response_format: { type: 'json_object' } } : {}),
    }),
  });

  if (!response.ok || !response.body) {
    const text = await response.text();
    res.write(`data: ${JSON.stringify({ error: parseProviderError(text, 'OpenAI stream failed') })}\n\n`);
    res.end();
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
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
      if (!payload) continue;
      if (payload === '[DONE]') {
        res.write('data: [DONE]\n\n');
        continue;
      }
      try {
        const parsed = JSON.parse(payload) as {
          choices?: { delta?: { content?: string } }[];
        };
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) {
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      } catch {
        // ignore malformed/partial SSE JSON lines
      }
    }
  }

  res.end();
}

async function streamAnthropic(body: AIRequestBody, res: express.Response) {
  const system = body.messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  const messages = withAnthropicJsonPrefill(
    body.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role, content: m.content })),
    body.jsonMode,
  );

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': body.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: body.model,
      max_tokens: body.maxTokens ?? 8000,
      temperature: body.temperature ?? 0.7,
      system: system || undefined,
      messages,
      stream: true,
    }),
  });

  if (!response.ok || !response.body) {
    const text = await response.text();
    res.write(`data: ${JSON.stringify({ error: parseProviderError(text, 'Anthropic stream failed') })}\n\n`);
    res.end();
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let prefaced = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n');
    buffer = parts.pop() || '';

    for (const line of parts) {
      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6).trim();
      if (!payload) continue;
      try {
        const parsed = JSON.parse(payload) as {
          type?: string;
          delta?: { type?: string; text?: string };
        };
        if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
          let content = parsed.delta.text;
          if (body.jsonMode && !prefaced) {
            content = `{${content}`;
            prefaced = true;
          }
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
        if (parsed.type === 'message_stop') {
          res.write('data: [DONE]\n\n');
        }
      } catch {
        // ignore
      }
    }
  }

  res.end();
}

if (process.env.NODE_ENV === 'production') {
  const path = await import('path');
  const { fileURLToPath } = await import('url');
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const dist = path.join(__dirname, '../dist');
  app.use(express.static(dist));
  app.get(/.*/, (_req, res) => {
    res.sendFile(path.join(dist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`On The Road AI proxy listening on http://localhost:${PORT}`);
});
