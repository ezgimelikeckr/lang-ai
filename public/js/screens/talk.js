// ─────────────────────────────────────────────────────────────────
// Konuşma ekranı: transkript, büyük mikrofon butonu, süre,
// duraklat/devam, yardım butonu.
// ─────────────────────────────────────────────────────────────────
import { el, icon, escapeHtml, toast, modal, closeModal } from '../ui.js';
import { navigate } from '../router.js';
import { Session } from '../conversation.js';
import { api } from '../api.js';
import { speak, stopSpeaking } from '../speech.js';
import { LANGUAGES, MODES, SCENARIOS } from '../storage.js';

const STATUS_LABELS = {
  listening: 'Dinliyorum…',
  thinking: 'Düşünüyor…',
  speaking: 'Konuşuyor…',
  paused: 'Duraklatıldı',
  help: 'Yardım alıyorsun',
};

function fmtClock(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export function render(root, params) {
  const config = params.config;
  const info = LANGUAGES[config.lang];
  const modeInfo = MODES[config.mode];

  let customStatus = null;
  let helpOpen = false;

  const screen = el(`
    <div class="screen talk-layout">
      <div class="talk-top">
        <div class="info">
          <button class="back-btn" id="exit-btn" title="Seansı bitir">${icon('back')}</button>
          <span class="emoji">${info.flag}</span>
          <div>
            <div class="title">${modeInfo.label}${config.mode === 'roleplay' ? ` · ${SCENARIOS[config.scenario]?.label || ''}` : ''}${config.mode === 'debate' && config.topic ? ` · ${escapeHtml(config.topic)}` : ''}</div>
            <div class="sub">${info.name} · Seviye ${config.level}</div>
          </div>
        </div>
        <div class="row">
          <select id="diff-select" title="Zorluk" style="padding:8px 12px;border-radius:10px;border:1.5px solid var(--border);background:var(--surface);font-size:.84rem">
            <option value="easy" ${config.difficulty === 'easy' ? 'selected' : ''}>🟢 Kolay</option>
            <option value="medium" ${config.difficulty === 'medium' ? 'selected' : ''}>🔵 Orta</option>
            <option value="hard" ${config.difficulty === 'hard' ? 'selected' : ''}>🔴 Zor</option>
          </select>
          <div class="timer" id="timer">00:00</div>
        </div>
      </div>

      <div class="transcript" id="transcript"></div>

      <div class="talk-controls">
        <div class="status-pill" id="status-pill"><span class="dot"></span><span id="status-label">Hazırlanıyor…</span></div>
        <div class="interim-text" id="interim"></div>
        <div class="mic-row">
          <button class="ctrl-btn help" id="help-btn" title="Konuşma yardımı — ne söyleyeceğini hatırlamıyorsan">${icon('help')}</button>
          <button class="mic-btn" id="mic-btn" title="Duraklat / devam et">
            <span class="mic-icon">${icon('mic')}</span>
            <span class="eq"><span></span><span></span><span></span><span></span></span>
          </button>
          <button class="ctrl-btn end" id="end-btn" title="Seansı bitir">${icon('stop')}</button>
        </div>
      </div>
    </div>`);

  root.appendChild(screen);

  const $ = (id) => screen.querySelector('#' + id);
  const transcript = $('transcript');
  const micBtn = $('mic-btn');
  const statusPill = $('status-pill');
  const statusLabel = $('status-label');

  // ── Seans motoru ───────────────────────────────────────────────
  const session = new Session(config, {
    onStateChange: (state) => updateUi(),
    onMessagesChanged: () => renderTranscript(),
    onInterim: (text) => { $('interim').textContent = text; },
    onTick: (sec) => { $('timer').textContent = fmtClock(sec); },
    onError: (msg) => toast(msg, 'error', 6000),
    onEnded: (sessionObj) => {
      if (sessionObj.userMessages === 0) {
        toast('Konuşma olmadığı için seans kaydedilmedi.');
        navigate('home');
      } else {
        navigate('analysis', { session: sessionObj, live: true });
      }
    },
  });

  // ── Transkript ─────────────────────────────────────────────────
  function renderTranscript() {
    transcript.innerHTML = '';
    session.messages.forEach((m) => {
      if (m.role === 'user') {
        transcript.appendChild(el(`<div class="msg user"><div class="who">Sen</div><div class="bubble">${escapeHtml(m.text)}</div></div>`));
        // Anlık düzeltme kartı (yalnız anlık modda; seans sonu modunda sonda gösterilir)
        if (m.correction && config.correctionMode === 'instant') {
          transcript.appendChild(renderCorrection(m.correction));
        }
      } else {
        transcript.appendChild(el(`<div class="msg"><div class="who">${info.name} Partneri</div><div class="bubble">${escapeHtml(m.text)}</div></div>`));
        if (m.phraseTip) {
          const pill = el(`
            <div class="phrase-tip">💡 <b>${escapeHtml(m.phraseTip.phrase)}</b> — ${escapeHtml(m.phraseTip.meaning_tr)}
              <button title="Dinle">${icon('speaker')}</button></div>`);
          pill.querySelector('button').addEventListener('click', () =>
            speak(m.phraseTip.phrase, info.ttsLang, { rate: 0.9, voiceURI: config.voiceURI })
          );
          transcript.appendChild(pill);
        }
      }
    });
    transcript.scrollTop = transcript.scrollHeight;
  }

  function renderCorrection(c) {
    const card = el(`
      <div class="correction-card">
        <div class="row"><span class="tag">✎ Sen:</span><span class="wrong">${escapeHtml(c.original)}</span></div>
        <div class="row"><span class="tag">✓ Doğrusu:</span><span class="right">${escapeHtml(c.corrected)}</span></div>
        ${c.explanation_tr ? `<div class="row"><span class="tag">ℹ</span><span class="explain">${escapeHtml(c.explanation_tr)}</span></div>` : ''}
        ${c.alternative ? `<div class="row"><span class="tag">→ Daha doğalı:</span><span class="alt">${escapeHtml(c.alternative)}</span></div>` : ''}
      </div>`);
    const listen = el(`<div class="row" style="margin-top:6px"><button class="btn ghost small">🔊 Doğrusunu dinle</button></div>`);
    listen.querySelector('button').addEventListener('click', () =>
      speak(c.corrected, info.ttsLang, { rate: 0.85, voiceURI: config.voiceURI })
    );
    card.appendChild(listen);
    return card;
  }

  // ── Durum çubuğu & mikrofon görünümü ───────────────────────────
  function updateUi() {
    const state = session.state;
    const label = customStatus ? STATUS_LABELS[customStatus] : STATUS_LABELS[state] || '…';
    statusLabel.textContent = label;
    statusPill.className = 'status-pill ' + (customStatus ? 'thinking' : state);

    micBtn.classList.toggle('listening', !customStatus && state === 'listening');
    micBtn.classList.toggle('speaking', !customStatus && state === 'speaking');
    micBtn.classList.toggle('thinking', !customStatus && state === 'thinking');
    micBtn.classList.toggle('paused', state === 'paused');
    micBtn.innerHTML = state === 'speaking' && !customStatus
      ? '<span class="eq"><span></span><span></span><span></span><span></span></span>'
      : icon('mic');
    if (state === 'paused') $('interim').textContent = '';
  }

  // ── Kontroller ─────────────────────────────────────────────────
  micBtn.addEventListener('click', () => {
    if (helpOpen) return;
    if (session.state === 'paused') session.resume();
    else session.pause();
  });

  $('diff-select').addEventListener('change', (e) => {
    session.opts.difficulty = e.target.value;
    config.difficulty = e.target.value;
    const names = { easy: 'Kolay', medium: 'Orta', hard: 'Zor' };
    toast('Zorluk güncellendi: ' + names[e.target.value]);
  });

  const confirmEnd = () => {
    modal({
      title: 'Seansı bitir?',
      sub: 'Analiz ekranına geçeceğiz.',
      actions: [
        { label: 'Vazgeç', class: 'ghost' },
        { label: 'Evet, bitir', class: 'primary', onClick: () => session.end() },
      ],
    });
  };
  $('end-btn').addEventListener('click', confirmEnd);
  $('exit-btn').addEventListener('click', confirmEnd);

  // ── Yardım butonu ──────────────────────────────────────────────
  $('help-btn').addEventListener('click', () => {
    if (helpOpen || session.ended) return;
    helpOpen = true;
    customStatus = 'help';
    session.helpActive = true;
    session.stopMic();
    stopSpeaking();
    updateUi();

    const content = el(`
      <div>
        <div class="field" style="margin-bottom:12px">
          <textarea id="help-input" placeholder="Ne söylemek istiyorsun? Türkçe veya ${info.name} yazabilirsin. Örn: hesabı bölmek istiyorum"></textarea>
        </div>
        <button class="btn primary small" id="help-go" style="width:100%">Öneri getir</button>
        <div id="help-result"></div>
      </div>`);

    const closeHelp = () => {
      helpOpen = false;
      customStatus = null;
      session.helpActive = false;
      closeModal();
      updateUi();
      // 'thinking' durumunda cevap gelince akış kendisi mikrofonu açar;
      // dinleme veya yarında kalan konuşma durumunda hemen aç.
      if (!session.ended && (session.state === 'listening' || session.state === 'speaking')) {
        session.startMic();
      }
    };

    const m = modal({
      title: '💡 Konuşma Yardımı',
      sub: `Söylemek istediğin ifadeyi ${info.name} olarak öneririm, anlamı ve telaffuzuyla.`,
      content,
      actions: [{ label: 'Kapat ve sohbete dön', class: 'ghost', onClick: () => {} }],
    });
    // backdrop tıklayınca da mikrofonu geri aç
    m.addEventListener('click', (e) => {
      if (e.target === m) closeHelp();
    });
    // "Kapat ve sohbete dön" butonu
    m.querySelector('.modal-actions .btn').addEventListener('click', closeHelp);

    const input = content.querySelector('#help-input');
    input.focus();

    const runHelp = async () => {
      const intent = input.value.trim();
      if (!intent) { toast('Ne söylemek istediğini yaz.'); return; }

      const resultBox = content.querySelector('#help-result');
      resultBox.innerHTML = '<div class="row" style="justify-content:center;padding:14px"><span class="loading-dots"><span></span><span></span><span></span></span></div>';

      try {
        const context = session.messages.slice(-6).map((x) => `${x.role === 'user' ? 'LEARNER' : 'PARTNER'}: ${x.text}`).join('\n');
        const res = await api.help({ language: config.lang, level: config.level, intent, context });

        resultBox.innerHTML = '';
        const box = el(`
          <div class="help-result">
            <div class="phrase">${escapeHtml(res.phrase)}</div>
            ${res.pronunciation ? `<div class="pron">Telaffuz: ${escapeHtml(res.pronunciation)}</div>` : ''}
            ${res.meaning_tr ? `<div class="meaning">🇹🇷 ${escapeHtml(res.meaning_tr)}</div>` : ''}
            <div id="help-alts"></div>
            <div class="row" style="margin-top:12px">
              <button class="btn ghost small" id="help-listen">🔊 Dinle</button>
              <span class="spacer"></span>
              <button class="btn primary small" id="help-use">Bunu söyle →</button>
            </div>
          </div>`);

        (res.alternatives || []).forEach((a, i) => {
          const alt = el(`
            <div class="alt-row">
              <b>${escapeHtml(a.phrase)}</b>
              ${a.pronunciation ? ` <span style="color:var(--muted);font-style:italic">(${escapeHtml(a.pronunciation)})</span>` : ''}
              <div style="font-size:.82rem;color:var(--text-soft)">${escapeHtml(a.meaning_tr || '')} <button class="alt-listen" style="color:var(--primary-deep);text-decoration:underline;font-size:.82rem">dinle</button></div>
            </div>`);
          alt.querySelector('.alt-listen').addEventListener('click', () =>
            speak(a.phrase, info.ttsLang, { rate: 0.85, voiceURI: config.voiceURI })
          );
          box.querySelector('#help-alts').appendChild(alt);
        });

        box.querySelector('#help-listen').addEventListener('click', () =>
          speak(res.phrase, info.ttsLang, { rate: 0.85, voiceURI: config.voiceURI })
        );
        box.querySelector('#help-use').addEventListener('click', () => {
          const phrase = res.phrase;
          closeHelp();
          session.sendPreparedPhrase(phrase);
        });

        resultBox.appendChild(box);
      } catch (e) {
        resultBox.innerHTML = `<div class="banner error" style="margin:0">${escapeHtml(e.message)}</div>`;
      }
    };

    content.querySelector('#help-go').addEventListener('click', runHelp);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); runHelp(); }
    });
  });

  // ── Başlat ─────────────────────────────────────────────────────
  updateUi();
  renderTranscript();
  session.begin();
}
