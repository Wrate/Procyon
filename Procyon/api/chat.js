import OpenAI from 'openai';

// ============================================================
// KONFIGURASI CLIENT
// ============================================================
const openai = new OpenAI({
  baseURL: 'https://api.groq.com/openai/v1',
  apiKey: process.env.GROQ_API_KEY,
});

const MODEL_NAME = 'llama-3.3-70b-versatile';
const REQUEST_TIMEOUT_MS = 25000; // biar gak nge-hang lama sebelum Vercel timeout
const MAX_RETRIES = 2;

// ============================================================
// PERSONA DEFINITIONS
// Tiap persona punya gaya bicara sendiri + temperature sendiri
// biar karakternya kerasa beda (Nova tegas & singkat, Lyra lebih "liar")
// ============================================================
const PERSONAS = {
  nova: {
    prompt:
      'Kamu adalah Nova. Jawablah dengan gaya cepat, ringkas, dan langsung ke inti masalah. Jangan bertele-tele, hindari basa-basi.',
    temperature: 0.4,
  },
  lyra: {
    prompt:
      'Kamu adalah Lyra. Jawablah dengan gaya kreatif, eksploratif, imajinatif, dan hangat. Tawarkan sudut pandang unik atau ide segar.',
    temperature: 0.9,
  },
  orion: {
    prompt:
      'Kamu adalah Orion. Jawablah dengan gaya detail, analitis, terstruktur, dan logis. Uraikan masalah langkah demi langkah.',
    temperature: 0.5,
  },
};

const DEFAULT_SYSTEM_PROMPT =
  'Kamu adalah Procyon, asisten AI interaktif yang pintar, membantu, dan ramah.';

// ============================================================
// HELPERS
// ============================================================

function buildMessages(systemPrompt, messages) {
  return [{ role: 'system', content: systemPrompt }, ...messages];
}

function validateMessages(messages) {
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return 'Format pesan tidak valid atau kosong.';
  }
  const isValid = messages.every(
    (m) =>
      m &&
      typeof m.content === 'string' &&
      m.content.trim().length > 0 &&
      ['user', 'assistant', 'system'].includes(m.role)
  );
  if (!isValid) return 'Setiap pesan harus punya role dan content yang valid.';
  return null;
}

// Panggil Groq dengan retry sederhana untuk error transient (5xx/timeout)
async function callWithRetry(payload, retries = MAX_RETRIES) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const completion = await openai.chat.completions.create(payload, {
      signal: controller.signal,
    });
    return completion;
  } catch (error) {
    const isTransient =
      error?.status >= 500 || error?.code === 'ETIMEDOUT' || error?.name === 'AbortError';
    if (isTransient && retries > 0) {
      await new Promise((r) => setTimeout(r, 500 * (MAX_RETRIES - retries + 1)));
      return callWithRetry(payload, retries - 1);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function mapErrorToResponse(error) {
  const status = error?.status || 500;

  if (status === 401) {
    return { status: 500, reply: 'Konfigurasi server bermasalah (API key tidak valid).' };
  }
  if (status === 429) {
    return {
      status: 429,
      reply: 'Server AI lagi sibuk (rate limit). Coba lagi beberapa saat lagi ya.',
    };
  }
  if (error?.name === 'AbortError') {
    return { status: 504, reply: 'Permintaan terlalu lama diproses. Coba kirim ulang.' };
  }
  return {
    status: 500,
    reply: 'Maaf, terjadi kesalahan pada server AI saat memproses permintaanmu.',
  };
}

// ============================================================
// HANDLER UTAMA
// mode "single" -> balasan satu persona seperti biasa
// mode "canvas" -> semua persona dipanggil paralel, hasilnya digabung
//                  { replies: { nova: "...", lyra: "...", orion: "..." } }
// stream: true  -> streaming SSE untuk mode "single" (biar ngetik real-time)
// ============================================================
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { messages, persona, mode = 'single', stream = false } = req.body;

  const validationError = validateMessages(messages);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  // ---------- CANVAS MODE: semua persona jawab paralel ----------
  if (mode === 'canvas') {
    try {
      const personaKeys = Object.keys(PERSONAS);

      const results = await Promise.allSettled(
        personaKeys.map((key) =>
          callWithRetry({
            model: MODEL_NAME,
            messages: buildMessages(PERSONAS[key].prompt, messages),
            temperature: PERSONAS[key].temperature,
            max_tokens: 1024,
          })
        )
      );

      const replies = {};
      results.forEach((result, i) => {
        const key = personaKeys[i];
        replies[key] =
          result.status === 'fulfilled'
            ? result.value.choices[0].message.content
            : 'Maaf, persona ini gagal merespons.';
      });

      return res.status(200).json({ replies });
    } catch (error) {
      console.error('Procyon Canvas Error:', error);
      const { status, reply } = mapErrorToResponse(error);
      return res.status(status).json({ reply });
    }
  }

  // ---------- SINGLE MODE ----------
  let systemPrompt = DEFAULT_SYSTEM_PROMPT;
  let temperature = 0.7;
  if (persona && PERSONAS[persona]) {
    systemPrompt = PERSONAS[persona].prompt;
    temperature = PERSONAS[persona].temperature;
  }

  const formattedMessages = buildMessages(systemPrompt, messages);

  // --- Streaming: ngirim token per token via SSE ---
  if (stream) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    try {
      const completionStream = await openai.chat.completions.create({
        model: MODEL_NAME,
        messages: formattedMessages,
        temperature,
        max_tokens: 1024,
        stream: true,
      });

      for await (const chunk of completionStream) {
        const token = chunk.choices[0]?.delta?.content || '';
        if (token) {
          res.write(`data: ${JSON.stringify({ token })}\n\n`);
        }
      }
      res.write('data: [DONE]\n\n');
      return res.end();
    } catch (error) {
      console.error('Procyon Stream Error:', error);
      res.write(`data: ${JSON.stringify({ error: 'Streaming gagal, coba lagi.' })}\n\n`);
      return res.end();
    }
  }

  // --- Non-streaming (default, kompatibel dengan frontend lama) ---
  try {
    const completion = await callWithRetry({
      model: MODEL_NAME,
      messages: formattedMessages,
      temperature,
      max_tokens: 1024,
    });

    const replyText = completion.choices[0].message.content;
    return res.status(200).json({ reply: replyText });
  } catch (error) {
    console.error('Procyon API Error:', error);
    const { status, reply } = mapErrorToResponse(error);
    return res.status(status).json({ reply });
  }
}
