// /api/chat.js
// Serverless function (Vercel, Node runtime) yang menjembatani frontend Procyon ke Groq API.
// Dipanggil oleh askAI() dan fetchPersonaReply() di index.html lewat POST /api/chat

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

// Catatan model (Agustus 2026):
// llama-3.1-8b-instant & llama-3.3-70b-versatile RESMI DI-DEPRECATE Groq,
// shutdown 16 Agustus 2026 — sengaja TIDAK dipakai di sini biar nggak
// kejadian lagi kayak sebelumnya (nama model deprecated bikin deploy gagal).
// Dipakai: openai/gpt-oss-120b (kualitas tinggi) & openai/gpt-oss-20b (paling cepat),
// keduanya model produksi aktif di Groq.
const DEFAULT_MODEL = 'openai/gpt-oss-120b';

const DEFAULT_SYSTEM =
  'Kamu adalah Procyon, asisten AI yang ramah, jelas, dan membantu. ' +
  'Balas dalam bahasa yang sama dengan pertanyaan pengguna — kalau dia pakai ' +
  'Bahasa Indonesia santai, balas santai juga, jangan kaku.';

// Tiga kepribadian untuk mode Multi (Nova / Lyra / Orion di index.html)
const PERSONAS = {
  nova: {
    model: 'openai/gpt-oss-20b',
    system:
      'Kamu adalah Nova, salah satu dari tiga kepribadian AI milik Procyon. ' +
      'Gaya kamu cepat dan ringkas: jawab langsung ke inti dalam 2-4 kalimat, ' +
      'tanpa basa-basi panjang, tapi tetap ramah dan jelas.'
  },
  lyra: {
    model: DEFAULT_MODEL,
    system:
      'Kamu adalah Lyra, salah satu dari tiga kepribadian AI milik Procyon. ' +
      'Gaya kamu kreatif dan eksploratif: boleh pakai analogi atau perumpamaan, ' +
      'tawarkan lebih dari satu sudut pandang, tapi tetap mudah dipahami.'
  },
  orion: {
    model: DEFAULT_MODEL,
    system:
      'Kamu adalah Orion, salah satu dari tiga kepribadian AI milik Procyon. ' +
      'Gaya kamu detail dan analitis: uraikan jawaban secara terstruktur ' +
      '(poin atau langkah bila relevan) dan beri konteks yang cukup.'
  }
};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'GROQ_API_KEY belum diset di environment variables Vercel.' });
    return;
  }

  try {
    const body = req.body || {};
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const persona = body.persona;

    if (messages.length === 0) {
      res.status(400).json({ error: '"messages" wajib diisi dan berupa array.' });
      return;
    }

    const cfg = PERSONAS[persona] || null;
    const model = cfg ? cfg.model : DEFAULT_MODEL;
    const systemPrompt = cfg ? cfg.system : DEFAULT_SYSTEM;

    // Batasi riwayat yang dikirim biar hemat token (10 pesan terakhir cukup untuk konteks)
    const trimmed = messages.slice(-10).map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.content || '').slice(0, 8000)
    }));

    const groqRes = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: systemPrompt }, ...trimmed],
        temperature: 0.7,
        max_completion_tokens: 1024
      })
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      console.error('Groq API error:', groqRes.status, errText);
      res.status(502).json({ error: 'Groq API gagal merespons.', detail: errText.slice(0, 300) });
      return;
    }

    const data = await groqRes.json();
    const reply = data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content
      : '(tidak ada respons dari model)';

    res.status(200).json({ reply, model });
  } catch (err) {
    console.error('Handler error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan di server.' });
  }
};
