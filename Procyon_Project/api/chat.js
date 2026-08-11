import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';

const app = express();
app.use(cors());
app.use(express.json());

// ============================================================
// PILIHAN 1: MENGGUNAKAN GROQ
// ============================================================
const openai = new OpenAI({
  baseURL: 'https://api.groq.com/openai/v1',
  apiKey: process.env.GROQ_API_KEY, // Set di Environment Variables Vercel
});

// PENTING: 'llama-3.3-70b-versatile' sudah di-deprecate oleh Groq
// (diumumkan 17 Juni 2026, dimatikan per Agustus 2026).
// Model pengganti resmi rekomendasi Groq:
const MODEL_NAME = 'openai/gpt-oss-120b';
// Alternatif lain yang juga direkomendasikan Groq: 'qwen/qwen3.6-27b'

// ============================================================
// PILIHAN 2: MENGGUNAKAN OPENROUTER (Uncomment jika pakai ini)
// ============================================================
/*
const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': 'https://procyon-app.vercel.app', // Opsional
    'X-Title': 'Procyon AI', // Opsional
  },
});
const MODEL_NAME = 'meta-llama/llama-3.3-70b-instruct';
*/

const PERSONA_PROMPTS = {
  nova: "Kamu adalah Nova. Gaya bicaramu analitis, logis, berbasis data, dan langsung ke inti teknis.",
  lyra: "Kamu adalah Lyra. Gaya bicaramu kreatif, penuh empati, imajinatif, dan suka memberi ide desain/opsi visual.",
  orion: "Kamu adalah Orion. Gaya bicaramu strategis, fokus pada perencanaan ringkas, efisiensi, dan arsitektur keputusan."
};

app.post('/api/chat', async (req, res) => {
  try {
    const { messages, persona } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Pesan tidak boleh kosong.' });
    }

    const systemInstruction = persona && PERSONA_PROMPTS[persona]
      ? PERSONA_PROMPTS[persona]
      : "Kamu adalah Procyon, asisten AI interaktif yang siap membantu pengguna.";

    // Gabungkan System Prompt di awal array pesan
    const formattedMessages = [
      { role: 'system', content: systemInstruction },
      ...messages
    ];

    const completion = await openai.chat.completions.create({
      model: MODEL_NAME,
      messages: formattedMessages,
      temperature: 0.7,
    });

    return res.json({ reply: completion.choices[0].message.content });

  } catch (error) {
    // Log lebih detail biar gampang debug kalau error lagi (mis. model_decommissioned,
    // invalid_api_key, rate_limit_exceeded, dll)
    console.error('Error:', error?.response?.data || error?.message || error);
    return res.status(500).json({ error: 'Terjadi kesalahan pada server AI.' });
  }
});

// Health check sederhana, berguna buat mastiin server hidup tanpa nge-hit Groq
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', model: MODEL_NAME });
});

if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Server berjalan di port ${PORT}`));
}

export default app;
