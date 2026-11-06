// ─────────────────────────────────────────────────────────────────
// Seans motoru: dinle → backend'e gönder → seslendir → tekrar dinle
// döngüsünü yönetir. UI'dan bağımsız; olaylarla bildirir.
// ─────────────────────────────────────────────────────────────────

import { api } from './api.js';
import { LANGUAGES } from './storage.js';
import { sttSupported, ttsSupported, createRecognizer, speak, stopSpeaking } from './speech.js';

const RATES = { easy: 0.82, medium: 0.95, hard: 1.06 };

export class Session {
  /**
   * opts: { lang, level, mode, scenario, topic, difficulty, correctionMode,
   *         voiceURI }
   * callbacks: { onStateChange, onMessagesChanged, onInterim, onError,
   *              onTick, onEnded }
   */
  constructor(opts, callbacks = {}) {
    this.opts = opts;
    this.cb = callbacks;
    this.messages = [];      // {role:'user'|'assistant', text, correction?, phraseTip?}
    this.corrections = [];   // seans boyunca toplanan tüm düzeltmeler
    this.phraseTips = [];    // önerilen ifadeler
    this.state = 'idle';     // listening | thinking | speaking | paused
    this.durationSec = 0;
    this.ended = false;
    this.wantListening = false;
    this.rec = null;
    this.timer = null;
  }

  get langInfo() {
    return LANGUAGES[this.opts.lang];
  }

  get ttsRate() {
    return RATES[this.opts.difficulty] || 1;
  }

  setState(s) {
    this.state = s;
    if (this.cb.onStateChange) this.cb.onStateChange(s);
  }

  // ── Yaşam döngüsü ──────────────────────────────────────────────

  async begin() {
    this.startTimer();
    this.setState('thinking');
    try {
      const res = await api.chat({ ...this.opts, history: [], start: true });
      this.pushAssistant(res.reply);
      await this.speakReply(res.reply);
      this.startMic();
    } catch (e) {
      if (this.ended) return;
      this.cb.onError?.(e.message);
      this.startMic(); // kullanıcı yeniden denemek için konuşmaya devam edebilsin
    }
  }

  end() {
    this.ended = true;
    this.wantListening = false;
    this.stopTimer();
    this.stopMic();
    stopSpeaking();
    this.setState('idle');
    if (this.cb.onEnded) this.cb.onEnded(this.buildSessionObject());
  }

  pause() {
    if (this.ended || this.state === 'paused') return;
    this.prePauseState = this.state;
    this.wantListening = false;
    this.stopMic();
    stopSpeaking();
    this.setState('paused');
  }

  resume() {
    if (this.ended || this.state !== 'paused') return;
    // Devam ederken yapay zekânın son mesajını tekrar dinletmek yerine
    // doğrudan dinlemeye geç (kullanıcı söz hakkına sahip).
    this.setState('listening');
    this.startMic();
  }

  // ── Zamanlayıcı ────────────────────────────────────────────────

  startTimer() {
    this.timer = setInterval(() => {
      if (this.state !== 'paused' && !this.ended) {
        this.durationSec++;
        this.cb.onTick?.(this.durationSec);
      }
    }, 1000);
  }

  stopTimer() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  // ── Mikrofon ───────────────────────────────────────────────────

  ensureRecognizer() {
    if (this.rec) return;
    this.rec = createRecognizer(this.langInfo.sttLang, {
      onFinal: (text) => this.handleFinalTranscript(text),
      onInterim: (text) => this.cb.onInterim?.(text),
      onError: (err) => this.cb.onError?.(err.message),
      onEnd: () => {
        this.recActive = false;
        // Otomatik yeniden dinleme: kullanıcıya düşünme/cevap süresi tanır.
        if (this.wantListening && !this.ended) {
          setTimeout(() => {
            if (this.wantListening && !this.ended && !this.recActive) this.tryStartRec();
          }, 300);
        }
      },
    });
  }

  tryStartRec() {
    if (this.recActive) return;
    try {
      this.rec.start();
      this.recActive = true;
    } catch {
      // zaten çalışıyor — sorun değil
    }
  }

  startMic() {
    if (this.ended || !sttSupported || this.helpActive) return;
    this.ensureRecognizer();
    this.wantListening = true;
    this.setState('listening');
    this.tryStartRec();
  }

  stopMic() {
    this.wantListening = false;
    if (this.rec) {
      try { this.rec.stop(); } catch { /* yoksay */ }
      this.recActive = false;
    }
  }

  // ── Mesaj akışı ────────────────────────────────────────────────

  handleFinalTranscript(text) {
    if (this.ended || this.state !== 'listening' || !text.trim()) return;
    this.stopMic(); // yapay zekâ sesini mikrofon duymasın
    this.cb.onInterim?.('');
    this.sendUserMessage(text.trim());
  }

  async sendUserMessage(text) {
    if (this.ended) return;
    const msg = { role: 'user', text };
    this.messages.push(msg);
    this.cb.onMessagesChanged?.();
    this.setState('thinking');

    try {
      // Geçmiş: son (şimdiki) kullanıcı mesajı hariç — sunucu onu
      // userMessage olarak ayrıca ekler, iki kez gitmesin.
      const history = this.messages
        .slice(0, -1)
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role, content: m.text }));

      const res = await api.chat({ ...this.opts, history, userMessage: text });

      if (this.ended) return;

      if (res.correction) {
        msg.correction = res.correction;
        this.corrections.push(res.correction);
      }
      if (res.phrase_tip) {
        this.phraseTips.push(res.phrase_tip);
      }
      this.pushAssistant(res.reply, res.phrase_tip);
      // Duraklatma sırasında seslendirme yapma; cevap ekranda görünür,
      // devam edildiğinde kullanıcı söz hakkına sahip olur.
      if (this.state === 'paused') return;
      await this.speakReply(res.reply);
      this.startMic();
    } catch (e) {
      if (this.ended) return;
      this.cb.onError?.(e.message);
      // Hata olsa da sohbeti kilitleme — dinlemeye dön
      this.startMic();
    }
  }

  /** Yardım butonundan gelen hazır ifadeyi kullanıcı adına gönderir. */
  sendPreparedPhrase(phrase) {
    this.sendUserMessage(phrase);
  }

  pushAssistant(text, phraseTip = null) {
    if (!text) return;
    this.messages.push({ role: 'assistant', text, phraseTip });
    this.cb.onMessagesChanged?.();
  }

  async speakReply(text) {
    if (!text) return;
    this.setState('speaking');
    await speak(text, this.langInfo.ttsLang, { rate: this.ttsRate, voiceURI: this.opts.voiceURI });
  }

  // ── Seans özeti ────────────────────────────────────────────────

  countUserWords() {
    return this.messages
      .filter((m) => m.role === 'user')
      .reduce((a, m) => a + m.text.split(/\s+/).filter(Boolean).length, 0);
  }

  countUserMessages() {
    return this.messages.filter((m) => m.role === 'user').length;
  }

  buildSessionObject() {
    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      date: new Date().toISOString(),
      lang: this.opts.lang,
      level: this.opts.level,
      mode: this.opts.mode,
      scenario: this.opts.scenario || null,
      topic: this.opts.topic || null,
      difficulty: this.opts.difficulty,
      correctionMode: this.opts.correctionMode,
      durationSec: this.durationSec,
      messages: this.messages,
      corrections: this.corrections,
      phraseTips: this.phraseTips,
      userWords: this.countUserWords(),
      userMessages: this.countUserMessages(),
      analysis: null,
    };
  }

  /** Analiz API'sine gönderilecek yük. */
  buildAnalysisPayload() {
    return {
      language: this.opts.lang,
      level: this.opts.level,
      mode: this.opts.mode,
      transcript: this.messages.map((m) => ({ role: m.role, text: m.text })),
      stats: {
        durationMin: Math.round(this.durationSec / 60 * 10) / 10,
        userWords: this.countUserWords(),
        userMessages: this.countUserMessages(),
      },
      corrections: this.corrections,
    };
  }
}

export { sttSupported, ttsSupported };
