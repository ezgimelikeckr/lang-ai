// Arkadaşınla sohbet: bir sahne, 5 tur, mikrofona dokunarak konuş
import { el, icon, escapeHtml, toast, hillsSvg, openSheet } from '../ui.js';
import { navigate, onCleanup } from '../router.js';
import { api } from '../api.js';
import { Session } from '../conversation.js';
import { stopSpeaking } from '../speech.js';
import { LANGUAGES, FRIENDS, sceneFor, difficultyFor, levelBand, MAX_TURNS } from '../data.js';
import { getProfile, addPoints, addSession } from '../storage.js';

export function render(root, params) {
  const profile = getProfile();
  const lang = profile.active;
  const level = profile.levels[lang] || 'A2';
  const friend = FRIENDS[params.friend] || FRIENDS.mia;
  const info = LANGUAGES[lang];
  const scene = sceneFor(friend, level);
  let slow = levelBand(level) === 'low';
  let finished = false;
  let sheetRef = null;

  const screen = el(`
    <div class="screen no-tabs">
      <div class="topbar">
        <button class="back-btn" id="back" aria-label="Geri">${icon('back')}</button>
        <div class="title">${friend.name} ile sohbet</div>
        <span class="badge-level">${level}</span>
      </div>
      <div class="meter"><b>${scene.label} · ${info.name}</b><span id="turnlabel"></span></div>
      <div class="pbar"><i id="pfill" style="width:0%"></i></div>
      <div class="scene chat">
        ${hillsSvg()}
        <span class="tagpill">Sanal arkadaşın</span>
        <div class="who"><img src="${friend.img}" alt="" height="150" /></div>
      </div>
      <div class="msg-card" id="msg"></div>
      <button class="hint-card" id="hint" style="display:none"></button>
      <div class="mic-zone">
        <h3>Şimdi sıra sende</h3>
        <div class="mic-wrap">
          <div class="side-wave" id="wl"><i></i><i></i><i></i><i></i></div>
          <div class="mic-halo" id="halo"><button class="mic-btn" id="mic" aria-label="Mikrofon">${icon('mic', 38, 1.8)}</button></div>
          <div class="side-wave" id="wr"><i></i><i></i><i></i><i></i></div>
        </div>
        <div class="live-text" id="live"></div>
        <p class="mic-help" id="help"></p>
      </div>
      <button class="end-link" id="end">Sohbeti bitir</button>
      <p class="encourage">Mükemmel değil, kendin gibi konuş.</p>
    </div>`);
  root.appendChild(screen);
  const $ = (id) => screen.querySelector('#' + id);

  const session = new Session({
    lang,
    level,
    mode: scene.mode,
    scenario: scene.scenario,
    topic: '',
    difficulty: difficultyFor(level),
    correctionMode: 'end',
    personaId: friend.id,
    learnerName: profile.name,
    autoListen: false,
    maxTurns: MAX_TURNS,
  }, {
    onStateChange: () => { renderMsg(); updateUi(); },
    onMessagesChanged: () => { renderMsg(); updateMeter(); },
    onInterim: (t) => { $('live').textContent = t; },
    onError: (m) => toast(m, 'error', 6000),
    onLimitReached: () => openSummary(),
    onEnded: () => openSummary(),
  });
  session.rateOverride = slow ? 0.8 : null;

  onCleanup(() => {
    finished = true;
    session.dispose();
    if (sheetRef) sheetRef.close();
  });

  // ── Çizim ──────────────────────────────────────────────────────
  function lastAssistant() {
    return [...session.messages].reverse().find((m) => m.role === 'assistant');
  }

  function updateMeter() {
    const n = session.countUserMessages();
    $('turnlabel').textContent = `${Math.min(n + 1, MAX_TURNS)} / ${MAX_TURNS} tur`;
    $('pfill').style.width = `${Math.min(100, (n / MAX_TURNS) * 100)}%`;
  }

  function renderMsg() {
    const msg = $('msg');
    const hint = $('hint');
    const st = session.state;
    const last = lastAssistant();

    if (st === 'thinking' || !last) {
      msg.className = 'msg-card typing';
      msg.innerHTML = `<div class="from">${escapeHtml(friend.name.toLocaleUpperCase('tr-TR'))}</div><div class="text"><span class="dots"><span></span><span></span><span></span></span> ${escapeHtml(friend.name)} yazıyor…</div>`;
      hint.style.display = 'none';
      return;
    }

    msg.className = 'msg-card';
    msg.innerHTML = `
      <div class="from">${escapeHtml(friend.name.toLocaleUpperCase('tr-TR'))}</div>
      <div class="text">${escapeHtml(last.text)}</div>
      ${last.tr ? `<div class="tr">🇹🇷 ${escapeHtml(last.tr)}</div>` : ''}
      <div class="row">
        <button class="btn-soft" id="replay">${icon('speaker', 18)} Tekrar dinle</button>
        <button class="meta" id="speed" style="background:none;color:var(--muted);font-weight:700;font-size:.78rem">${slow ? 'Yavaş hız' : 'Normal hız'} ⇄</button>
      </div>`;
    msg.querySelector('#replay').addEventListener('click', () => {
      if (st === 'speaking') return;
      session.speakSample(last.text, info.ttsLang, { rate: slow ? 0.78 : 1.0, voiceURI: undefined });
    });
    msg.querySelector('#speed').addEventListener('click', () => {
      slow = !slow;
      session.rateOverride = slow ? 0.8 : null;
      msg.querySelector('#speed').textContent = `${slow ? 'Yavaş hız' : 'Normal hız'} ⇄`;
    });

    const userTurn = (st === 'ready' || st === 'listening' || st === 'paused') && !finished;
    if (userTurn && last.hint && last.hint.phrase) {
      hint.style.display = '';
      hint.innerHTML = `
        <span style="color:var(--yellow-deep)">${icon('bulb', 26)}</span>
        <span style="flex:1"><span class="cap2">Bir başlangıç istersen…</span>
          <b>“${escapeHtml(last.hint.phrase)}”</b>
          ${last.hint.meaning_tr ? `<small>${escapeHtml(last.hint.meaning_tr)}</small>` : ''}</span>
        <span style="color:var(--yellow-deep)">${icon('speaker', 20)}</span>`;
      hint.onclick = () => session.speakSample(last.hint.phrase, info.ttsLang, { rate: slow ? 0.78 : 1.0 });
    } else {
      hint.style.display = 'none';
    }
  }

  function updateUi() {
    const st = session.state;
    const n = session.countUserMessages();
    const busy = st === 'thinking' || st === 'speaking';
    $('halo').className = 'mic-halo' + (st === 'listening' ? ' listening' : busy ? ' busy' : '');
    ['wl', 'wr'].forEach((id) => $(id).classList.toggle('live', st === 'listening'));
    if (st !== 'listening') $('live').textContent = '';
    const help = {
      thinking: `${friend.name} düşünüyor…`,
      speaking: `${friend.name} konuşuyor… (atlamak için dokun)`,
      ready: n === 0 ? 'Mikrofona dokun, sohbet başlasın.' : 'Mikrofona dokun ve cevabını söyle.',
      listening: 'Dinliyorum… Bitirince mikrofona tekrar dokun.',
      paused: 'Mikrofon kullanılamadı. Mesajı okuyup tekrar dene.',
      idle: '',
    };
    $('help').textContent = help[st] ?? '';
  }

  // ── Mikrofon ───────────────────────────────────────────────────
  $('mic').addEventListener('click', () => {
    const st = session.state;
    if (st === 'ready' || st === 'paused') session.startMic();
    else if (st === 'listening') session.finishNow();
    else if (st === 'speaking') stopSpeaking(); // konuşmayı atla
  });

  $('back').addEventListener('click', () => (session.countUserMessages() > 0 ? session.end() : navigate('friends')));
  $('end').addEventListener('click', () => (session.countUserMessages() > 0 ? session.end() : navigate('friends')));

  // ── Sohbet sonu ────────────────────────────────────────────────
  async function openSummary() {
    if (finished) return;
    finished = true;
    session.stopMic();
    stopSpeaking();
    const turns = session.countUserMessages();
    if (turns === 0) { navigate('friends'); return; }

    const earned = 20;
    addPoints(earned);
    sheetRef = openSheet(`
      <h2>Güzel sohbet! ✨</h2>
      <div class="earn">${icon('star', 18)} +${earned} puan</div>
      <p class="sub" id="sum">Notların hazırlanıyor…</p>
      <div id="topics"></div>
      <button class="btn-primary" id="home" style="margin-top:8px">Bahçeme dön ${icon('arrow', 22, 2.4)}</button>
      <button class="end-link" id="again" style="margin-top:14px">Arkadaşlara dön</button>`);
    const q = (id) => sheetRef.sheet.querySelector('#' + id);
    q('home').addEventListener('click', () => navigate('home'));
    q('again').addEventListener('click', () => navigate('friends'));

    let topics = [];
    try {
      const a = await api.analyze(session.buildAnalysisPayload());
      q('sum').textContent = a.summary_tr || 'Güzel bir pratikti, devam et!';
      topics = (a.practice_topics || []).slice(0, 2);
      q('topics').innerHTML = topics.length
        ? '<h3 style="margin:6px 0 10px">Çalışılacak konular</h3>' + topics.map((t) => `
            <div class="topic"><b>${escapeHtml(t.topic_tr)}</b>
              ${t.example ? `<div class="ex"><s>${escapeHtml(t.example.wrong)}</s> → <strong>${escapeHtml(t.example.right)}</strong></div>` : ''}
              ${t.exercise_tr ? `<div class="ex" style="margin-top:4px">${escapeHtml(t.exercise_tr)}</div>` : ''}</div>`).join('')
        : '';
    } catch {
      q('sum').textContent = 'Notlar şu an hazırlanamadı ama puanın hesabında.';
    }
    addSession({
      date: new Date().toISOString(), lang, friend: friend.id, scene: scene.label, level,
      turns, points: earned, topics: topics.map((t) => t.topic_tr),
    });
  }

  updateMeter();
  updateUi();
  renderMsg();
  session.begin();
}