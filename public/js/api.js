// ─────────────────────────────────────────────────────────────────
// Backend API istemcisi
// ─────────────────────────────────────────────────────────────────

async function post(path, body) {
  let res;
  try {
    res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('Sunucuya ulaşılamıyor. Uygulama çalışıyor mu? (npm start)');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Sunucu hatası (${res.status})`);
  return data;
}

export const api = {
  async status() {
    const res = await fetch('/api/status');
    if (!res.ok) throw new Error('Sunucu durumu alınamadı.');
    return res.json();
  },

  chat(payload) {
    return post('/api/chat', payload);
  },

  help(payload) {
    return post('/api/help', payload);
  },

  analyze(payload) {
    return post('/api/analyze', payload);
  },
};
