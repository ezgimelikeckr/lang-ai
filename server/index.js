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
  buildStartInstruction,
  getFocus,
  pickFocus,
  rampHint,
  greetingStep,
  LEVEL_SHORT,
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

/**
 * Sohbet cevabını ayrıştırır. Model JSON yerine düz metin döndürürse
 * konuşma kopmasın diye ham metni cevap olarak kullanır (düzeltme olmadan).
 */
function parseChatReply(raw) {
  try {
    return extractJson(raw);
  } catch (e) {
    console.error('[/api/chat] JSON okunamadı:', e.message);
    console.error('[/api/chat] Ham cevap:', String(raw).slice(0, 500));
    const plain = String(raw).replace(/```[\s\S]*?```/g, '').trim();
    return { reply: plain, correction: null, phrase_tip: null };
  }
}

function str(v) {
  return typeof v === 'string' ? v : '';
}

function sanitizeCorrection(c) {
  if (!c || !c.corrected) return null;
  return {
    original: str(c.original),
    corrected: str(c.corrected),
    explanation_tr: str(c.explanation_tr),
    type: c.type === 'vocabulary' ? 'vocabulary' : 'grammar',
    practice_topic_tr: str(c.practice_topic_tr),
    alternative: str(c.alternative),
  };
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

    const { language, level, mode, scenario, topic, difficulty, correctionMode, history = [], userMessage, start = false, focus: focusId } = req.body;

    if (!start && (!userMessage || !userMessage.trim())) {
      return res.status(400).json({ error: 'userMessage gerekli.' });
    }
    if (mode === 'roleplay' && scenario && !SCENARIOS[scenario]) {
      return res.status(400).json({ error: 'Geçersiz rol yapma senaryosu.' });
    }

    const lvl = LEVELS.includes(level) ? level : 'A2';

    // Kaçıncı konuşma sırası? (0 = açılış) — kademeli zorlaşma için
    const userTurns = (Array.isArray(history) ? history : []).filter((m) => m && m.role === 'user').length;
    const turn = start ? 0 : userTurns + 1;

    // Seans konusu: istemci gönderdiyse onu kullan, açılışta rastgele seç
    let focus = getFocus(focusId);
    if (!focus && start) focus = pickFocus(lvl, language);

    console.log(`[chat] ${language} ${lvl} ${mode} ${difficulty} konu=${focus ? focus.id : '-'} tur=${turn}${start ? ' (açılış)' : ''}`);

    const system = buildSystemPrompt({ language, level: lvl, mode, scenario, topic, difficulty, correctionMode, focus, turn });

    // Geçmişi 30 mesajla sınırla (token ekonomisi).
    // Asistan mesajları JSON biçiminde gönderilir; model aynı biçimi sürdürsün.
    const trimmed = (Array.isArray(history) ? history : [])
      .filter((m) => m && typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant'))
      .slice(-30)
      .map((m) =>
        m.role === 'assistant'
          ? {
              role: 'assistant',
              content: JSON.stringify({ reply: m.content, reply_tr: str(m.tr), correction: null, phrase_tip: null }),
            }
          : { role: 'user', content: m.content }
      );

    const messages = [{ role: 'system', content: system }, ...trimmed];
    if (start) {
      messages.push({ role: 'user', content: buildStartInstruction({ mode, level: lvl, topic, focus }) });
    } else {
      messages.push({ role: 'user', content: userMessage.trim() });
    }

    // Her turda seviye ve biçim hatırlatması (modelin seviyeden kaymasını önler)
    messages.push({
      role: 'system',
      content: `Reminder: answer with ONE JSON object only (keys: reply, reply_tr, hint, correction, phrase_tip). Stay strictly at CEFR level ${lvl}: ${LEVEL_SHORT[lvl]}. ${focus ? `Keep steering toward today's focus: ${focus.en}. ` : ''}Do not repeat an earlier question. ${rampHint(turn, lvl)} ${greetingStep(turn, lvl, mode)}`,
    });

    // Açılışta daha yaratıcı (her seferinde farklı) olsun
    const raw = await chat(messages, { temperature: start ? 1.0 : 0.7 });
    const parsed = parseChatReply(raw);

    res.json({
      reply: str(parsed.reply),
      reply_tr: str(parsed.reply_tr),
      hint: parsed.hint && parsed.hint.phrase ? { phrase: str(parsed.hint.phrase), meaning_tr: str(parsed.hint.meaning_tr) } : null,
      correction: sanitizeCorrection(parsed.correction),
      phrase_tip: parsed.phrase_tip && parsed.phrase_tip.phrase ? parsed.phrase_tip : null,
      focus: focus ? { id: focus.id, tr: focus.tr, kind: focus.kind } : null,
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
    const { language, level, mode, transcript, stats, corrections, focus: focusId } = req.body;
    if (!LANGUAGES.includes(language)) return res.status(400).json({ error: 'Geçersiz dil.' });

    const system = buildAnalysisPrompt({
      focus: getFocus(focusId),
      language,
      level: LEVELS.includes(level) ? level : 'A2',
      mode: MODE_LABELS[mode] ? mode : 'free',
      transcript: Array.isArray(transcript) ? transcript : [],
      stats: stats || { durationMin: 0, userWords: 0, userMessages: 0 },
      corrections: Array.isArray(corrections) ? corrections : [],
    });

    const raw = await chat([{ role: 'user', content: system }], { temperature: 0.5, maxTokens: 1600 });
    const parsed = extractJson(raw);

    const practiceTopics = Array.isArray(parsed.practice_topics)
      ? parsed.practice_topics
          .filter((t) => t && t.topic_tr)
          .slice(0, 5)
          .map((t) => ({
            topic_tr: String(t.topic_tr),
            kind: t.kind === 'vocabulary' ? 'vocabulary' : 'grammar',
            why_tr: String(t.why_tr || ''),
            example: t.example && t.example.wrong
              ? { wrong: String(t.example.wrong), right: String(t.example.right || '') }
              : null,
            exercise_tr: String(t.exercise_tr || ''),
          }))
      : [];

    res.json({
      summary_tr: parsed.summary_tr || '',
      focus_feedback_tr: str(parsed.focus_feedback_tr),
      strengths_tr: Array.isArray(parsed.strengths_tr) ? parsed.strengths_tr : [],
      improvements_tr: Array.isArray(parsed.improvements_tr) ? parsed.improvements_tr : [],
      practice_topics: practiceTopics,
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