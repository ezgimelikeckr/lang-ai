// ─────────────────────────────────────────────────────────────────
// Ekran: 4 soruluk sesli/yazılı mini seviye belirleme testi
// ─────────────────────────────────────────────────────────────────
import { navigate, onCleanup } from '../router.js';
import { LANGUAGES, TEST_QUESTIONS, MIA_VOICE } from '../data.js';
import { getProfile, setLevel } from '../storage.js';
import { api } from '../api.js';
import { speak, stopSpeaking, sttSupported, checkMic } from '../speech.js';
import { el, icon, escapeHtml, toast } from '../ui.js';

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

function estimateLevelLocal(answers) {
  const valid = answers.filter((a) => a && a.trim().length > 1);
  if (!valid.length) return { level: 'A1', scores: { fluency: 35, vocab: 30, grammar: 35 }, reason: 'Başlangıç adımı atıldı.' };
  const totalWords = valid.reduce((sum, a) => sum + a.trim().split(/\s+/).length, 0);
  const avg = totalWords / answers.length;
  let level = 'A1';
  if (avg >= 22) level = 'C1';
  else if (avg >= 15) level = 'B2';
  else if (avg >= 9) level = 'B1';
  else if (avg >= 4.5) level = 'A2';

  const base = { A1: 38, A2: 52, B1: 66, B2: 78, C1: 88, C2: 95 }[level];
  return {
    level,
    scores: {
      fluency: Math.min(98, base + 4),
      vocab: Math.min(98, base - 2),
      grammar: Math.min(98, base + 1),
    },
    reason: 'Cevaplarının uzunluğu ve akıcılığına göre belirlendi.',
  };
}

export function render(root, params = {}) {
  const profile = getProfile();
  const langCode = params.lang || profile.active || profile.languages[0] || 'en';
  const lang = LANGUAGES[langCode] || LANGUAGES.en;
  const questions = TEST_QUESTIONS[langCode] || TEST_QUESTIONS.en;

  let step = 0;
  const answers = ['', '', '', ''];
  let recording = false;
  let recognition = null;
  let timerId = null;
  let seconds = 0;
  let currentTranscript = '';
  let interimTranscript = '';
  let showTextFallback = !sttSupported;
  let assessing = false;

  onCleanup(() => {
    stopSpeaking();
    stopRec(false);
    clearInterval(timerId);
  });

  const screen = el(`<div class="screen no-tabs"></div>`);
  root.appendChild(screen);

  function fmtTime(sec) {
    const m = String(Math.floor(sec / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    return `${m}:${s}`;
  }

  function stopRec(save = true) {
    recording = false;
    clearInterval(timerId);
    timerId = null;
    if (recognition) {
      try { recognition.onend = null; recognition.stop(); } catch { /* yoksay */ }
      recognition = null;
    }
    if (save) {
      const full = `${currentTranscript} ${interimTranscript}`.trim();
      if (full) answers[step] = full;
    }
    interimTranscript = '';
  }

  async function startRec() {
    if (recording || assessing) return;
    stopSpeaking();
    const mic = await checkMic();
    if (!mic.ok) {
      showTextFallback = true;
      toast('Mikrofona erişilemedi, cevabını yazarak devam edebilirsin.');
      draw();
      return;
    }

    currentTranscript = answers[step] || '';
    interimTranscript = '';
    seconds = 0;
    recording = true;

    recognition = new SR();
    recognition.lang = lang.sttLang;
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (e) => {
      let fin = '';
      let inter = '';
      for (let i = 0; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) fin += t + ' ';
        else inter += t;
      }
      currentTranscript = fin.trim();
      interimTranscript = inter.trim();
      const heardEl = screen.querySelector('#heard-text');
      if (heardEl) heardEl.textContent = `${currentTranscript} ${interimTranscript}`.trim() || 'Dinleniyor...';
    };

    recognition.onerror = () => {
      stopRec(true);
      showTextFallback = true;
      draw();
    };

    recognition.onend = () => {
      if (recording) {
        try { recognition.start(); } catch { stopRec(true); draw(); }
      }
    };

    try {
      recognition.start();
    } catch {
      recording = false;
      showTextFallback = true;
    }

    timerId = setInterval(() => {
      seconds++;
      const tEl = screen.querySelector('#rec-timer');
      if (tEl) tEl.textContent = fmtTime(seconds);
      if (seconds >= 45) {
        stopRec(true);
        draw();
      }
    }, 1000);

    draw();
  }

  function askQuestion() {
    speak(questions[step], lang.ttsLang, { locale: MIA_VOICE[langCode], gender: 'f', rate: 0.96 });
  }

  async function finishTest() {
    if (assessing) return;
    stopRec(true);
    stopSpeaking();
    assessing = true;
    draw();

    const pairs = questions.map((q, i) => ({ question: q, answer: answers[i] || '' }));
    let resData = null;

    try {
      if (typeof api.assess === 'function') {
        resData = await api.assess({ language: langCode, answers: pairs });
      }
    } catch {
      resData = null;
    }

    if (!resData || !resData.level) {
      resData = estimateLevelLocal(answers);
    }

    setLevel(langCode, resData.level);
    navigate('result', {
      lang: langCode,
      level: resData.level,
      scores: resData.scores || estimateLevelLocal(answers).scores,
      reason: resData.reason || '',
    });
  }

  function draw() {
    const q = questions[step];
    const ans = answers[step] || '';

    screen.innerHTML = `
      <div class="topbar">
        <button class="back-btn" id="btn-back" aria-label="Geri">${icon('back')}</button>
        <div class="title">${lang.name} · Mini Test</div>
        <span class="pill">${step + 1} / ${questions.length}</span>
      </div>

      <div class="seg">
        ${questions.map((_, i) => `<i class="${i <= step ? 'done' : ''}"></i>`).join('')}
      </div>
      <div class="progress-meta">
        <span>Soru ${step + 1}</span>
        <span>${step === questions.length - 1 ? 'Son soru' : `${questions.length - step - 1} soru kaldı`}</span>
      </div>

      <div class="ask-row">
        <div class="ask-card">
          <button type="button" class="listen" id="btn-listen" aria-label="Soruyu dinle">${icon('speaker', 22)}</button>
          <div class="cap">MIA SORUYOR</div>
          <div class="q">${escapeHtml(q)}</div>
        </div>
        <img src="assets/mia.png" alt="Mia" />
      </div>

      <div class="rec-card">
        <div class="rec-status ${recording ? '' : 'idle'}">${recording ? 'Kaydediliyor...' : (ans ? 'Cevap kaydedildi' : 'Cevaplamak için mikrofona bas')}</div>
        <div class="timer" id="rec-timer">${fmtTime(seconds)}</div>
        <div class="wave ${recording ? 'live' : ''}">
          ${Array.from({ length: 14 }).map(() => '<i></i>').join('')}
        </div>

        ${recording ? `
          <button type="button" class="stop-btn" id="btn-stop" aria-label="Kaydı durdur"><i></i></button>
        ` : `
          <button type="button" class="stop-btn mic" id="btn-rec" aria-label="Kaydı başlat" style="color:#fff">
            <i>${icon('mic', 22)}</i>
          </button>
        `}

        <div class="heard" id="heard-text">${ans ? `"${escapeHtml(ans)}"` : 'Konuştukların burada görünecek'}</div>
      </div>

      ${showTextFallback ? `
        <div class="fallback">
          <textarea id="txt-ans" placeholder="Cevabını ${lang.name} olarak buraya yazabilirsin...">${escapeHtml(ans)}</textarea>
        </div>
      ` : `
        <div class="note">
          <button type="button" class="btn-soft" id="btn-type">Konuşamıyor musun? Yazarak cevapla</button>
        </div>
      `}

      <div class="footer-cta">
        <button type="button" class="btn-primary" id="btn-next" ${assessing ? 'disabled' : ''}>
          <span>${assessing ? 'Seviyen hesaplanıyor...' : (step < questions.length - 1 ? 'Sonraki soru' : 'Seviyemi gör')}</span>
          ${!assessing ? icon('arrow', 20) : ''}
        </button>
        ${step < questions.length - 1 ? `<button type="button" class="tiny" id="btn-skip" style="margin-top:10px;display:inline-block">Bu soruyu atla</button>` : ''}
      </div>
    `;

    screen.querySelector('#btn-back').addEventListener('click', () => {
      stopRec(false);
      if (step > 0) {
        step--;
        seconds = 0;
        draw();
        askQuestion();
      } else {
        navigate('languages');
      }
    });

    screen.querySelector('#btn-listen').addEventListener('click', askQuestion);
    screen.querySelector('#btn-rec')?.addEventListener('click', startRec);
    screen.querySelector('#btn-stop')?.addEventListener('click', () => {
      stopRec(true);
      draw();
    });

    screen.querySelector('#btn-type')?.addEventListener('click', () => {
      showTextFallback = true;
      draw();
    });

    const txtArea = screen.querySelector('#txt-ans');
    if (txtArea) {
      txtArea.addEventListener('input', () => {
        answers[step] = txtArea.value;
      });
    }

    const goNext = () => {
      stopRec(true);
      if (step < questions.length - 1) {
        step++;
        seconds = 0;
        draw();
        askQuestion();
      } else {
        finishTest();
      }
    };

    screen.querySelector('#btn-next').addEventListener('click', goNext);
    screen.querySelector('#btn-skip')?.addEventListener('click', () => {
      answers[step] = '';
      goNext();
    });
  }

  draw();
  setTimeout(askQuestion, 300);
}
