export default async function handler(req, res) {
  // CORS preflight
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Health check
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      message: "Procyon API aktif"
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "GROQ_API_KEY belum diset" });
    }

    const { messages, persona } = req.body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Messages tidak valid" });
    }

    const personaInstructions = {
      nova: "Jawablah dengan cepat, ringkas, dan langsung ke inti.",
      lyra: "Jawablah secara kreatif, eksploratif, dan berikan beberapa sudut pandang jika cocok.",
      orion: "Jawablah secara detail, terstruktur, dan analitis."
    };

    let systemPrompt =
      "Kamu adalah Procyon, AI assistant yang membantu pengguna dengan jelas, ramah, dan akurat. Gunakan bahasa Indonesia kecuali pengguna meminta bahasa lain.";

    if (persona && personaInstructions[persona]) {
      systemPrompt += " " + personaInstructions[persona];
    }

    const groqMessages = [
      { role: "system", content: systemPrompt },
      ...messages
    ];

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: groqMessages,
          temperature: 0.7,
          max_completion_tokens: 2048
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Groq error:", data);
      return res.status(response.status).json({
        error: data?.error?.message || "Groq API error"
      });
    }

    const reply = data?.choices?.[0]?.message?.content || "(respons kosong)";

    return res.status(200).json({ reply });

  } catch (error) {
    console.error("API error:", error);
    return res.status(500).json({
      error: "Terjadi kesalahan pada server",
      detail: error.message
    });
  }
}
