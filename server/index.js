// ─────────────────────────────────────────────────────────────────
// Express sunucusu: statik frontend + LLM proxy API'leri.
// ─────────────────────────────────────────────────────────────────
import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chat, extractJson, isConfigured, modelInfo } from './llm.js';
import {
  buildSystemPrompt,
  buildHelpPrompt,
  buildAnalysisPrompt,
  START_INSTRUCTION,
  MODE_LABELS,
  SCENARIOS,
} from './prompts.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

const LANGUAGES = ['en', 'fr', 'es'];
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const MODE_KEYS = ['daily', 'free', 'roleplay', 'debate', 'story'];

function validateSessionParams(body) {
  const { language, level, mode, difficulty, correctionMode } = body;
  if (!LANGUAGES.includes(language)) return 'Geçersiz dil.';
  if (level && !LEVELS.includes(level)) return 'Geçersiz seviye.';
  if (!MODE_KEYS.includes(mode)) return 'Geçersiz mod.';
  if (!['easy', 'medium', 'hard'].includes(difficulty)) return 'Geçersiz zorluk.';
  if (!['instant', 'end'].includes(correctionMode)) return 'Geçersiz düzeltme modu.';
  return null;
}

// ── Durum kontrolü ───────────────────────────────────────────────
app.get('/api/status', (_req, res) => {
  res.json(modelInfo());
});

// ── Sohbet ───────────────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  try {
    const err = validateSessionParams(req.body);
    if (err) return res.status(400).json({ error: err });

    const { language, level, mode, scenario, topic, difficulty, correctionMode, history = [], userMessage, start = false } = req.body;

    if (!start && (!userMessage || !userMessage.trim())) {
      return res.status(400).json({ error: 'userMessage gerekli.' });
    }
    if (mode === 'roleplay' && scenario && !SCENARIOS[scenario]) {
      return res.status(400).json({ error: 'Geçersiz rol yapma senaryosu.' });
    }

    const system = buildSystemPrompt({ language, level, mode, scenario, topic, difficulty, correctionMode });

    // Geçmişi 30 mesajla sınırla (token ekonomisi)
    const trimmed = (Array.isArray(history) ? history : [])
      .filter((m) => m && typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant'))
      .slice(-30)
      .map((m) => ({ role: m.role, content: m.content }));

    const messages = [{ role: 'system', content: system }, ...trimmed];
    if (start) {
      messages.push({ role: 'user', content: START_INSTRUCTION });
    } else {
      messages.push({ role: 'user', content: userMessage.trim() });
    }

    const raw = await chat(messages);
    const parsed = extractJson(raw);

    res.json({
      reply: typeof parsed.reply === 'string' ? parsed.reply : '',
      correction: parsed.correction && parsed.correction.corrected ? parsed.correction : null,
      phrase_tip: parsed.phrase_tip && parsed.phrase_tip.phrase ? parsed.phrase_tip : null,
    });
  } catch (e) {
    console.error('[/api/chat]', e.message);
    res.status(500).json({ error: e.code === 'NO_API_KEY' ? e.message : 'Sohbet çağrısı başarısız: ' + e.message });
  }
});

// ── Konuşma yardımı ──────────────────────────────────────────────
app.post('/api/help', async (req, res) => {
  try {
    const { language, level, intent, context } = req.body;
    if (!LANGUAGES.includes(language)) return res.status(400).json({ error: 'Geçersiz dil.' });
    if (!intent || !intent.trim()) return res.status(400).json({ error: 'Ne söylemek istediğinizi yazın.' });

    const system = buildHelpPrompt({ language, level: LEVELS.includes(level) ? level : 'A2', intent: intent.trim(), context });
    const raw = await chat([{ role: 'user', content: system }], { temperature: 0.4 });
    const parsed = extractJson(raw);

    if (!parsed.phrase) return res.status(502).json({ error: 'Yardım cevabı ayrıştırılamadı.' });
    res.json({
      phrase: parsed.phrase,
      pronunciation: parsed.pronunciation || '',
      meaning_tr: parsed.meaning_tr || '',
      alternatives: Array.isArray(parsed.alternatives) ? parsed.alternatives.filter((a) => a && a.phrase) : [],
    });
  } catch (e) {
    console.error('[/api/help]', e.message);
    res.status(500).json({ error: e.code === 'NO_API_KEY' ? e.message : 'Yardım çağrısı başarısız: ' + e.message });
  }
});

// ── Seans analizi ────────────────────────────────────────────────
app.post('/api/analyze', async (req, res) => {
  try {
    const { language, level, mode, transcript, stats, corrections } = req.body;
    if (!LANGUAGES.includes(language)) return res.status(400).json({ error: 'Geçersiz dil.' });

    const system = buildAnalysisPrompt({
      language,
      level: LEVELS.includes(level) ? level : 'A2',
      mode: MODE_LABELS[mode] ? mode : 'free',
      transcript: Array.isArray(transcript) ? transcript : [],
      stats: stats || { durationMin: 0, userWords: 0, userMessages: 0 },
      corrections: Array.isArray(corrections) ? corrections : [],
    });

    const raw = await chat([{ role: 'user', content: system }], { temperature: 0.5, maxTokens: 1200 });
    const parsed = extractJson(raw);

    res.json({
      summary_tr: parsed.summary_tr || '',
      strengths_tr: Array.isArray(parsed.strengths_tr) ? parsed.strengths_tr : [],
      improvements_tr: Array.isArray(parsed.improvements_tr) ? parsed.improvements_tr : [],
      new_phrases: Array.isArray(parsed.new_phrases) ? parsed.new_phrases.filter((p) => p && p.phrase) : [],
    });
  } catch (e) {
    console.error('[/api/analyze]', e.message);
    res.status(500).json({ error: e.code === 'NO_API_KEY' ? e.message : 'Analiz çağrısı başarısız: ' + e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✓ Konuşma Pratiği çalışıyor:  http://localhost:${PORT}`);
  if (!isConfigured()) {
    console.log('⚠ UYARI: LLM_API_KEY .env dosyasında tanımlı değil — yapay zekâ sohbeti devre dışı olacak.');
    console.log('  .env dosyasını açın ve OpenRouter anahtarınızı LLM_API_KEY satırına yazın.');
  } else {
    console.log(`✓ LLM bağlı: ${modelInfo().model}`);
  }
});
