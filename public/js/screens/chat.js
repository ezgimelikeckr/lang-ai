// ─────────────────────────────────────────────────────────────────
// Ekran: Sesli & Yazılı Sohbet + Seans Sonu Analiz Özeti
// ─────────────────────────────────────────────────────────────────
import { navigate, onCleanup } from '../router.js';
import { LANGUAGES, FRIENDS, MAX_TURNS, difficultyFor, sceneFor } from '../data.js';
import { getProfile, addPoints, addSession } from '../storage.js';
import { api } from '../api.js';
import { speak, stopSpeaking, sttSupported, checkMic } from '../speech.js';
import { el, icon, hillsSvg, openSheet, escapeHtml, toast } from '../ui.js';

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

export function render(root, params = {}) {
  const profile = getProfile();
  const activeCode = profile.active || profile.languages[0] || 'en';
  const lang = LANGUAGES[activeCode] || LANGUAGES.en;
  const level = profile.levels[activeCode] || 'A2';
  const friend = FRIENDS[params.friendId] || FRIENDS.mia;
  const scene = sceneFor(friend, level);

  // Backend şu an en, fr, es dillerini destekliyor; de seçiliyse güvenli fallback
  const apiLang = ['en', 'fr', 'es'].includes(activeCode) ? activeCode : 'en';

  let history = [];
  let corrections = [];
  let lastReply = '';
  let lastReplyTr = '';
  let lastHint = null;
  let showTr = false;
  let showHint = false;
  let persona = null;
  let focus = null;

  let turn = 0;
  let busy = false;
  let listening = false;
  let recognition = null;
  let liveText = '';
  const startedAt = Date.now();

  onCleanup(() => {
    stopSpeaking();
    stopListening(false);
  });

  const screen = el(`<div class="screen no-tabs"></div>`);
  root.appendChild(screen);

  function stopListening(send = false) {
    listening = false;
    if (recognition) {
      try { recognition.onend = null; recognition.stop(); } catch { /* yoksay */ }
      recognition = null;
    }
    const text = liveText.trim();
    liveText = '';
    if (send && text) {
      sendUserMessage(text);
    } else {
      draw();
    }
  }

  async function toggleMic() {
    if (busy) return;
    if (listening) {
      stopListening(true);
      return;
    }
    if (!sttSupported) {
      openTextSheet();
      return;
    }
    stopSpeaking();
    const mic = await checkMic();
    if (!mic.ok) {
      toast('Mikrofona erişilemedi, yazarak devam edebilirsin.');
      openTextSheet();
      return;
    }

    liveText = '';
    listening = true;
    recognition = new SR();
    recognition.lang = lang.sttLang;
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (e) => {
      let full = '';
      for (let i = 0; i < e.results.length; i++) {
        full += e.results[i][0].transcript;
      }
      liveText = full;
      const elLive = screen.querySelector('#live-text');
      if (elLive) elLive.textContent = liveText ? `"${liveText}"` : 'Dinleniyor...';
    };

    recognition.onerror = () => {
      stopListening(false);
      toast('Ses algılanamadı, tekrar deneyebilir veya yazabilirsin.');
    };

    recognition.onend = () => {
      if (listening) {
        stopListening(true);
      }
    };

    try {
      recognition.start();
    } catch {
      listening = false;
    }
    draw();
  }

  function openTextSheet() {
    const box = el(`
      <div>
        <h2>Mesajını yaz</h2>
        <p class="sub">${friend.name} ile ${lang.name} pratik yapıyorsun.</p>
        <div class="fallback" style="margin-top:0">
          <textarea id="chat-txt" placeholder="${lang.name} bir cümle yaz..."></textarea>
        </div>
        <button type="button" class="btn-primary" id="btn-send-txt" style="margin-top:12px">Gönder</button>
      </div>
    `);
    const { close } = openSheet(box);
    const inp = box.querySelector('#chat-txt');
    setTimeout(() => inp.focus(), 100);
    box.querySelector('#btn-send-txt').addEventListener('click', () => {
      const val = inp.value.trim();
      if (!val) return;
      close();
      sendUserMessage(val);
    });
  }

  function speakReply() {
    if (!lastReply) return;
    speak(lastReply, lang.ttsLang, {
      locale: persona?.voice || lang.ttsLang,
      gender: persona?.gender || (friend.id === 'leo' ? 'm' : 'f'),
      rate: level === 'A1' || level === 'A2' ? 0.92 : 1.0,
    });
  }

  async function startConversation() {
    busy = true;
    draw();
    try {
      const res = await api.chat({
        language: apiLang,
        level,
        mode: scene.mode,
        scenario: scene.scenario,
        difficulty: difficultyFor(level),
        correctionMode: 'instant',
        start: true,
      });
      lastReply = res.reply || 'Hello! Ready to practice?';
      lastReplyTr = res.reply_tr || '';
      lastHint = res.hint || null;
      persona = res.persona || null;
      focus = res.focus || null;
      history.push({ role: 'assistant', content: lastReply, tr: lastReplyTr });
      busy = false;
      draw();
      speakReply();
    } catch (e) {
      busy = false;
      lastReply = 'Hello! How are you doing today?';
      lastReplyTr = 'Merhaba! Bugün nasılsın?';
      history.push({ role: 'assistant', content: lastReply, tr: lastReplyTr });
      toast(e.message || 'Sunucu bağlantısı kurulamadı, çevrimdışı açılış yapıldı.', 'error');
      draw();
    }
  }

  async function sendUserMessage(text) {
    if (busy || !text.trim()) return;
    history.push({ role: 'user', content: text.trim() });
    turn++;
    showTr = false;
    showHint = false;
    busy = true;
    draw();

    try {
      const res = await api.chat({
        language: apiLang,
        level,
        mode: scene.mode,
        scenario: scene.scenario,
        difficulty: difficultyFor(level),
        correctionMode: 'instant',
        history,
        userMessage: text.trim(),
        focus: focus?.id,
        persona: persona?.id,
      });

      if (res.correction) corrections.push(res.correction);
      lastReply = res.reply || '';
      lastReplyTr = res.reply_tr || '';
      lastHint = res.hint || null;
      history.push({ role: 'assistant', content: lastReply, tr: lastReplyTr });
      busy = false;
      draw();
      speakReply();
    } catch (e) {
      busy = false;
      toast(e.message || 'Cevap alınamadı.', 'error');
      draw();
    }
  }

  async function endConversation() {
    stopSpeaking();
    stopListening(false);

    const userMsgs = history.filter((m) => m.role === 'user');
    const userWords = userMsgs.reduce((s, m) => s + m.content.trim().split(/\s+/).length, 0);
    const durationMin = Math.max(1, Math.round((Date.now() - startedAt) / 60000));
    const earnedPoints = Math.max(5, userMsgs.length * 10);

    addPoints(earnedPoints);
    addSession({
      id: Date.now(),
      date: new Date().toISOString(),
      lang: activeCode,
      level,
      friendId: friend.id,
      friendName: friend.name,
      sceneTitle: scene.step.title,
      turns: userMsgs.length,
      words: userWords,
      points: earnedPoints,
    });

    const sheetContent = el(`
      <div>
        <div class="earn">${icon('star', 18)} +${earnedPoints} puan kazandın!</div>
        <h2>Harika bir sohbetti!</h2>
        <p class="sub">${friend.name} ile ${userMsgs.length} tur konuştun ve toplam ${userWords} kelime kullandın.</p>
        <div id="analysis-area" class="card green" style="margin-bottom:14px">
          <div class="dots"><span></span><span></span><span></span></div>
          <p class="tiny" style="margin-top:6px">Geri bildirimlerin hazırlanıyor...</p>
        </div>
        <button type="button" class="btn-primary" id="btn-finish-home">Bahçeme dön</button>
      </div>
    `);

    const { close } = openSheet(sheetContent);
    sheetContent.querySelector('#btn-finish-home').addEventListener('click', () => {
      close();
      navigate('home');
    });

    if (userMsgs.length === 0) {
      sheetContent.querySelector('#analysis-area').innerHTML = '<p>Bir sonraki sohbette birkaç cümle kurduğunda sana özel geri bildirimler burada görünecek.</p>';
      return;
    }

    try {
      const analysis = await api.analyze({
        language: apiLang,
        level,
        mode: scene.mode,
        transcript: history,
        stats: { durationMin, userWords, userMessages: userMsgs.length },
        corrections,
        focus: focus?.id,
      });

      const area = sheetContent.querySelector('#analysis-area');
      area.className = '';
      area.innerHTML = `
        ${analysis.summary_tr ? `<div class="topic"><b>Genel değerlendirme</b><p class="ex">${escapeHtml(analysis.summary_tr)}</p></div>` : ''}
        ${(analysis.practice_topics || []).slice(0, 2).map((t) => `
          <div class="topic">
            <b>${escapeHtml(t.topic_tr)}</b>
            <p class="ex">${escapeHtml(t.why_tr)}</p>
            ${t.example ? `<p class="ex" style="margin-top:4px"><s>${escapeHtml(t.example.wrong)}</s> → <strong>${escapeHtml(t.example.right)}</strong></p>` : ''}
          </div>
        `).join('')}
      `;
    } catch {
      sheetContent.querySelector('#analysis-area').innerHTML = '<p>Sohbetin kaydedildi ve puanların hesabına eklendi.</p>';
    }
  }

  function draw() {
    const pct = Math.min(100, Math.round((turn / MAX_TURNS) * 100));

    screen.innerHTML = `
      <div class="topbar">
        <button class="back-btn" id="btn-back" aria-label="Geri">${icon('back')}</button>
        <div class="title">${friend.name}</div>
        <span class="badge-level">${lang.code} · ${level}</span>
      </div>

      <div class="meter">
        <b>${escapeHtml(scene.label)}</b>
        <span>${Math.min(turn, MAX_TURNS)} / ${MAX_TURNS} tur</span>
      </div>
      <div class="pbar"><i style="width:${pct}%"></i></div>

      <div class="scene chat">
        ${hillsSvg()}
        <span class="tagpill">${escapeHtml(scene.step.tag)}</span>
        <div class="who">
          <img src="${friend.img}" alt="${friend.name}" style="height:142px" />
        </div>
      </div>

      <div class="msg-card ${busy ? 'typing' : ''}">
        <div class="from">${friend.name.toUpperCase()}</div>
        ${busy ? `
          <div class="text"><div class="dots"><span></span><span></span><span></span></div></div>
        ` : `
          <div class="text">${escapeHtml(lastReply)}</div>
          ${showTr && lastReplyTr ? `<div class="tr">${escapeHtml(lastReplyTr)}</div>` : ''}
          <div class="row">
            <div style="display:flex;gap:8px">
              <button type="button" class="btn-soft" id="btn-speak">${icon('speaker', 16)} Dinle</button>
              ${lastReplyTr ? `<button type="button" class="btn-soft" id="btn-tr">${showTr ? 'Çeviriyi gizle' : 'Türkçesi'}</button>` : ''}
            </div>
            <span class="meta">${lang.name}</span>
          </div>
        `}
      </div>

      ${lastHint && !busy ? `
        <button type="button" class="hint-card" id="btn-hint">
          <div style="color:var(--yellow-deep);flex:none">${icon('bulb', 22)}</div>
          <div>
            <div class="cap2">${showHint ? 'ÖNERİLEN CEVAP' : 'Ne diyeceğini bilemiyor musun? İpucu için dokun'}</div>
            ${showHint ? `<b>${escapeHtml(lastHint.phrase)}</b><small>${escapeHtml(lastHint.meaning_tr)}</small>` : ''}
          </div>
        </button>
      ` : ''}

      <div class="mic-zone">
        <h3>${listening ? 'Seni dinliyorum...' : (turn >= MAX_TURNS ? 'Harika ilerledin! Devam edebilir veya bitirebilirsin' : 'Sıra sende')}</h3>
        <div class="mic-wrap">
          <div class="side-wave ${listening ? 'live' : ''}"><i></i><i></i><i></i></div>
          <div class="mic-halo ${listening ? 'listening' : ''} ${busy ? 'busy' : ''}">
            <button type="button" class="mic-btn" id="btn-mic" aria-label="Konuş" ${busy ? 'disabled' : ''}>
              ${icon('mic', 34)}
            </button>
          </div>
          <div class="side-wave ${listening ? 'live' : ''}"><i></i><i></i><i></i></div>
        </div>
        <div class="mic-help">${listening ? 'Bitirdiğinde tekrar dokun' : 'Konuşmak için mikrofona dokun'}</div>
        <div class="live-text" id="live-text">${liveText ? `"${escapeHtml(liveText)}"` : ''}</div>

        <div style="margin-top:10px">
          <button type="button" class="btn-soft" id="btn-keyboard">${icon('chat', 16)} Yazarak cevapla</button>
        </div>

        <button type="button" class="end-link" id="btn-end">Sohbeti bitir ve puan kazan</button>
        <div class="encourage">Hata yapmaktan çekinme, önemli olan pratik yapmak.</div>
      </div>
    `;

    screen.querySelector('#btn-back').addEventListener('click', () => navigate('home'));
    screen.querySelector('#btn-speak')?.addEventListener('click', speakReply);
    screen.querySelector('#btn-tr')?.addEventListener('click', () => {
      showTr = !showTr;
      draw();
    });
    screen.querySelector('#btn-hint')?.addEventListener('click', () => {
      showHint = !showHint;
      draw();
    });
    screen.querySelector('#btn-mic')?.addEventListener('click', toggleMic);
    screen.querySelector('#btn-keyboard')?.addEventListener('click', openTextSheet);
    screen.querySelector('#btn-end')?.addEventListener('click', endConversation);
  }

  startConversation();
}
