// ─────────────────────────────────────────────────────────────────
// LLM istemcisi — OpenAI-uyumlu uç nokta (varsayılan: OpenRouter).
// Anahtar yalnızca sunucu tarafında (.env) tutulur.
// ─────────────────────────────────────────────────────────────────

const BASE_URL = (process.env.LLM_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/+$/, '');
const MODEL = process.env.LLM_MODEL || 'openai/gpt-4o-mini';
const API_KEY = process.env.LLM_API_KEY;

export function isConfigured() {
  return Boolean(API_KEY && API_KEY.trim());
}

export function modelInfo() {
  return { model: MODEL, baseUrl: BASE_URL, configured: isConfigured() };
}

/**
 * Sohbet tamamlama çağrısı. messages: [{role, content}]
 */
export async function chat(messages, { temperature = 0.7, maxTokens = 900 } = {}) {
  if (!isConfigured()) {
    const err = new Error('LLM API anahtarı yapılandırılmamış. .env dosyasındaki LLM_API_KEY değerini doldurun.');
    err.code = 'NO_API_KEY';
    throw err;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);

  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY.trim()}`,
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'Konusma Pratigi',
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature,
        max_tokens: maxTokens,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`LLM API hatası (${res.status}): ${body.slice(0, 300)}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('LLM boş cevap döndürdü.');
    return content;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * LLM cevabından JSON çıkarır — kod bloklarına ve baş/son metinlere toleranslı.
 */
export function extractJson(text) {
  let t = (text || '').trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('LLM cevabında JSON bulunamadı.');
  }
  return JSON.parse(t.slice(start, end + 1));
}
