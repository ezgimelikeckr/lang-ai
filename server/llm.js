// ─────────────────────────────────────────────────────────────────
// LLM istemcisi — OpenAI-uyumlu uç nokta (varsayılan: OpenRouter).
// Anahtar yalnızca sunucu tarafında (.env) tutulur.
// ─────────────────────────────────────────────────────────────────

const BASE_URL = (process.env.LLM_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/+$/, '');
const MODEL = process.env.LLM_MODEL || 'openai/gpt-4o-mini';
const API_KEY = process.env.LLM_API_KEY;
// Model JSON modunu desteklemiyorsa .env'e LLM_JSON_MODE=off yazılabilir
const JSON_MODE = (process.env.LLM_JSON_MODE || 'on').toLowerCase() !== 'off';

export function isConfigured() {
  return Boolean(API_KEY && API_KEY.trim());
}

export function modelInfo() {
  return { model: MODEL, baseUrl: BASE_URL, configured: isConfigured() };
}

async function request(messages, { temperature, maxTokens, json }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);

  try {
    const body = {
      model: MODEL,
      messages,
      temperature,
      max_tokens: maxTokens,
    };
    // Modeli yalnızca geçerli bir JSON nesnesi döndürmeye zorlar
    if (json) body.response_format = { type: 'json_object' };

    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY.trim()}`,
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'Konusma Pratigi',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      const err = new Error(`LLM API hatası (${res.status}): ${text.slice(0, 300)}`);
      err.status = res.status;
      throw err;
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
 * Sohbet tamamlama çağrısı. messages: [{role, content}]
 * json: true ise model JSON nesnesi döndürmeye zorlanır.
 */
export async function chat(messages, { temperature = 0.7, maxTokens = 900, json = true } = {}) {
  if (!isConfigured()) {
    const err = new Error('LLM API anahtarı yapılandırılmamış. .env dosyasındaki LLM_API_KEY değerini doldurun.');
    err.code = 'NO_API_KEY';
    throw err;
  }

  const useJson = json && JSON_MODE;
  try {
    return await request(messages, { temperature, maxTokens, json: useJson });
  } catch (e) {
    // Seçilen model response_format'ı desteklemiyorsa normal modla yeniden dene
    if (useJson && e.status === 400 && /response_format|json/i.test(e.message)) {
      console.warn('[LLM] JSON modu desteklenmiyor, normal modla yeniden deneniyor.');
      return request(messages, { temperature, maxTokens, json: false });
    }
    throw e;
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
  try {
    return JSON.parse(t.slice(start, end + 1));
  } catch {
    throw new Error('LLM cevabı geçerli JSON değil.');
  }
}