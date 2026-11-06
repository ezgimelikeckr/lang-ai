// ─────────────────────────────────────────────────────────────────
// Seans analizi ekranı: istatistikler, LLM değerlendirmesi,
// düzeltmeler, yeni ifadeler. Hem canlı seans sonunda hem geçmişten
// açılır.
// ─────────────────────────────────────────────────────────────────
import { el, icon, escapeHtml, toast } from '../ui.js';
import { navigate } from '../router.js';
import { api } from '../api.js';
import { speak } from '../speech.js';
import { screenHeader, topbar } from './parts.js';
import {
  LANGUAGES, MODES, SCENARIOS, formatDuration, saveSession, addVocab,
} from '../storage.js';

export function render(root, params) {
  const session = params.session;
  const live = Boolean(params.live);
  const info = LANGUAGES[session.lang];

  root.appendChild(topbar(null));

  const screen = el(`
    <div class="screen">
      <div id="an-header"></div>
      <div class="stat-grid">
        <div class="stat-tile"><div class="value">${formatDuration(session.durationSec)}</div><div class="label">Konuşma süresi</div></div>
        <div class="stat-tile"><div class="value">${session.userWords}</div><div class="label">Söylediğin kelime</div></div>
        <div class="stat-tile"><div class="value">${session.userMessages}</div><div class="label">Sıra sayısı</div></div>
        <div class="stat-tile"><div class="value">${session.corrections?.length || 0}</div><div class="label">Düzeltme</div></div>
      </div>
      <div id="an-body"></div>
      <div class="row mt" style="justify-content:center">
        <button class="btn primary" id="again-btn">🎙️ Tekrar konuş</button>
        <button class="btn ghost" id="home-btn">Ana ekran</button>
      </div>
    </div>`);

  screen.querySelector('#an-header').appendChild(
    screenHeader('🎉 Seans tamamlandı', `${info.flag} ${info.name} · ${MODES[session.mode]?.label || session.mode}${session.scenario ? ` (${SCENARIOS[session.scenario]?.label || ''})` : ''} · ${new Date(session.date).toLocaleString('tr-TR')}`, 'home')
  );

  const body = screen.querySelector('#an-body');
  root.appendChild(screen);

  // ── Kelime defterine hızlı ekleme ──────────────────────────────
  const addToVocab = (phrase, meaning) => {
    const ok = addVocab(session.lang, {
      word: phrase,
      meaning,
      pronunciation: '',
      example: '',
    });
    toast(ok ? `“${phrase}” deftere eklendi.` : 'Bu ifade zaten defterde.', ok ? 'ok' : 'info');
  };

  // ── Görsel bölümler ────────────────────────────────────────────
  const renderAnalysis = () => {
    const a = session.analysis;
    body.innerHTML = '';

    if (a) {
      if (a.summary_tr) {
        body.appendChild(el(`
          <div class="card section" style="margin-bottom:20px">
            <h3>📋 Değerlendirme</h3>
            <div style="font-size:.95rem">${escapeHtml(a.summary_tr)}</div>
          </div>`));
      }
      if (a.strengths_tr?.length) {
        const s = el(`<div class="card section strengths"><h3>Güçlü yönlerin</h3><ul></ul></div>`);
        a.strengths_tr.forEach((x) => s.querySelector('ul').appendChild(el(`<li>${escapeHtml(x)}</li>`)));
        body.appendChild(s);
      }
      if (a.improvements_tr?.length) {
        const s = el(`<div class="card section improve" style="margin-bottom:20px"><h3>Geliştirilecek noktalar</h3><ul></ul></div>`);
        a.improvements_tr.forEach((x) => s.querySelector('ul').appendChild(el(`<li>${escapeHtml(x)}</li>`)));
        body.appendChild(s);
      }
    }

    // Yeni ifadeler (LLM önerileri + seans içi ipuçları, birleşik)
    const phrases = [...(a?.new_phrases || []), ...(session.phraseTips || [])]
      .filter((p) => p && p.phrase)
      .filter((p, i, arr) => arr.findIndex((q) => q.phrase.toLowerCase() === p.phrase.toLowerCase()) === i);

    if (phrases.length) {
      const box = el(`<div class="card section" style="margin-bottom:20px"><h3>💡 Öğrenilecek ifadeler</h3><div id="phrases"></div></div>`);
      phrases.forEach((p) => {
        const row = el(`
          <div class="phrase-row">
            <div><div class="p">${escapeHtml(p.phrase)}</div><div class="m">${escapeHtml(p.meaning_tr || '')}</div></div>
            <div class="actions">
              <button class="icon-btn speak" title="Dinle">${icon('speaker')}</button>
              <button class="icon-btn" title="Deftere ekle">${icon('plus')}</button>
            </div>
          </div>`);
        const btns = row.querySelectorAll('button');
        btns[0].addEventListener('click', () => speak(p.phrase, info.ttsLang, { rate: 0.85 }));
        btns[1].addEventListener('click', () => addToVocab(p.phrase, p.meaning_tr || ''));
        box.querySelector('#phrases').appendChild(row);
      });
      body.appendChild(box);
    }

    // Düzeltmeler
    const corrections = session.corrections || [];
    if (corrections.length) {
      const title = session.correctionMode === 'end'
        ? '✍️ Toplu düzeltmeler'
        : '✍️ Düzeltmelerin (özet)';
      const box = el(`<div class="card section" style="margin-bottom:20px"><h3>${title}</h3><div id="corr"></div></div>`);
      corrections.forEach((c) => {
        const card = el(`
          <div class="correction-card" style="align-self:stretch;max-width:100%">
            <div class="row"><span class="tag">✎ Sen:</span><span class="wrong">${escapeHtml(c.original)}</span></div>
            <div class="row"><span class="tag">✓ Doğrusu:</span><span class="right">${escapeHtml(c.corrected)}</span></div>
            ${c.explanation_tr ? `<div class="row"><span class="tag">ℹ</span><span class="explain">${escapeHtml(c.explanation_tr)}</span></div>` : ''}
            ${c.alternative ? `<div class="row"><span class="tag">→ Daha doğalı:</span><span class="alt">${escapeHtml(c.alternative)}</span></div>` : ''}
          </div>`);
        box.querySelector('#corr').appendChild(card);
      });
      body.appendChild(box);
    }

    if (!a && !corrections.length && !phrases.length) {
      body.appendChild(el(`<div class="empty-state"><div class="icon">🌫️</div>Bu seans için gösterilecek analiz yok.</div>`));
    }
  };

  // ── Analiz akışı ───────────────────────────────────────────────
  const runAnalysis = async () => {
    if (session.analysis || session.userMessages === 0) { renderAnalysis(); return; }

    body.innerHTML = `
      <div class="card" style="text-align:center;padding:40px">
        <div class="loading-dots" style="justify-content:center"><span></span><span></span><span></span></div>
        <div style="margin-top:12px;color:var(--text-soft);font-size:.92rem">Seansın analiz ediliyor…</div>
      </div>`;

    try {
      const payload = {
        language: session.lang,
        level: session.level,
        mode: session.mode,
        transcript: session.messages.map((m) => ({ role: m.role, text: m.text })),
        stats: {
          durationMin: Math.round(session.durationSec / 60 * 10) / 10,
          userWords: session.userWords,
          userMessages: session.userMessages,
        },
        corrections: session.corrections || [],
      };
      session.analysis = await api.analyze(payload);
    } catch (e) {
      toast('Analiz alınamadı: ' + e.message, 'error', 6000);
      session.analysis = null;
    }

    renderAnalysis();

    // Canlı seans bitti — analiziyle birlikte kaydet
    if (live) saveSession(session.lang, session);
  };

  // ── Butonlar ───────────────────────────────────────────────────
  screen.querySelector('#again-btn').addEventListener('click', () => {
    navigate('setup', { lang: session.lang });
  });
  screen.querySelector('#home-btn').addEventListener('click', () => navigate('home'));

  runAnalysis();
}
