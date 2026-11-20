// ─────────────────────────────────────────────────────────────────
// Ortak arayüz yardımcıları: öğe oluşturma, simgeler, alt sekme çubuğu,
// alt sayfa (sheet), bildirim, sahne arka planı
// ─────────────────────────────────────────────────────────────────
import { navigate } from './router.js';

export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const ICONS = {
  leaf: '<path d="M5 19c0-9 5-14 14-14 0 9-5 14-14 14Z"/><path d="M5 19c3-4 6-7 10-9"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  back: '<path d="m15 5-7 7 7 7"/>',
  star: '<path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9 6.8 19.7l1-5.9L3.5 9.7l5.9-.8L12 3.5Z"/>',
  speaker: '<path d="M4 9.5v5h4l5 4v-13l-5 4H4Z"/><path d="M16.5 9a4 4 0 0 1 0 6"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3"/>',
  home: '<path d="m4 11 8-6.5 8 6.5v8a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1v-8Z"/>',
  people: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19c.5-3.2 2.7-5 5.5-5s5 1.8 5.5 5"/><circle cx="17" cy="9.5" r="2.5"/><path d="M16 14.2c2.4-.3 4.1 1.1 4.5 4.3"/>',
  chart: '<path d="M6 20V11M12 20V5M18 20v-6"/>',
  bulb: '<path d="M9 17.5h6M10 20.5h4M12 3.5a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3.5Z"/>',
  chat: '<path d="M5 5.5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-7l-4 3v-3H5a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Z"/><path d="M8 9.5h8M8 12.5h5"/>',
  gift: '<rect x="4" y="9" width="16" height="11" rx="2"/><path d="M12 9v11M4 13h16M12 9c-2-4-6-3.5-5 0M12 9c2-4 6-3.5 5 0"/>',
};

export function icon(name, size = 22, stroke = 2) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}

export function brand() {
  return `<div class="brand"><span class="logo" style="color:var(--green)">${icon('leaf', 22, 2.2)}</span><span>lingo</span></div>`;
}

export function toast(msg, type = 'info', ms = 4500) {
  const box = document.getElementById('toast-container');
  if (!box) return;
  const t = el(`<div class="toast ${type === 'error' ? 'error' : ''}">${escapeHtml(msg)}</div>`);
  box.appendChild(t);
  setTimeout(() => t.remove(), ms);
}

/** Alt sekme çubuğu: Bahçem · Arkadaşlar · Gelişim */
export function tabBar(active) {
  const tabs = [
    ['home', 'Bahçem', 'home'],
    ['friends', 'Arkadaşlar', 'people'],
    ['progress', 'Gelişim', 'chart'],
  ];
  const bar = el(`<nav class="tabbar">${tabs.map(([id, label, ic]) =>
    `<button class="tab ${id === active ? 'on' : ''}" data-go="${id}">${icon(ic, 24)}<span>${label}</span></button>`).join('')}</nav>`);
  bar.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.go !== active) navigate(b.dataset.go);
  }));
  return bar;
}

/** Alttan açılan sayfa. İçerik bir HTML metni ya da öğe olabilir. */
export function openSheet(content) {
  const overlay = el('<div class="overlay"><div class="sheet"></div></div>');
  const sheet = overlay.querySelector('.sheet');
  if (typeof content === 'string') sheet.innerHTML = content; else sheet.appendChild(content);
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  return { overlay, sheet, close };
}

/** Tepeli, yumuşak yeşil sahne arka planı (SVG) */
export function hillsSvg() {
  return `<svg class="hills" viewBox="0 0 360 330" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <rect width="360" height="330" fill="#dbe9ea"/>
    <ellipse cx="70" cy="62" rx="44" ry="14" fill="#f3f7f4"/><ellipse cx="300" cy="96" rx="40" ry="12" fill="#f3f7f4"/>
    <path d="M0 190 Q70 130 150 175 T300 160 T360 175 V330 H0Z" fill="#bcd2b6"/>
    <path d="M0 225 Q90 170 190 215 T360 205 V330 H0Z" fill="#a8c7a2"/>
    <path d="M0 262 Q110 222 220 255 T360 248 V330 H0Z" fill="#d3e4c2"/>
    <path d="M150 330 Q175 285 215 262 Q245 246 262 218" stroke="#f1ead2" stroke-width="22" fill="none" stroke-linecap="round" opacity=".9"/>
    <g fill="#f3d86a"><circle cx="42" cy="285" r="3"/><circle cx="96" cy="300" r="3"/><circle cx="318" cy="292" r="3"/><circle cx="290" cy="312" r="3"/></g>
  </svg>`;
}
