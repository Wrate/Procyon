export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const { messages, persona } = req.body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: "Messages kosong"
      });
    }

    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "GROQ_API_KEY belum dipasang di Vercel"
      });
    }

    // System prompt untuk Multi-AI
    let systemPrompt =
      "Kamu adalah Procyon, asisten AI yang membantu pengguna dengan jelas, akurat, dan ramah.";

    if (persona === "nova") {
      systemPrompt =
        "Kamu adalah Nova, AI yang cepat dan ringkas. Jawab langsung ke inti dengan jelas.";
    }

    if (persona === "lyra") {
      systemPrompt =
        "Kamu adalah Lyra, AI yang kreatif dan eksploratif. Berikan ide dan sudut pandang yang menarik.";
    }

    if (persona === "orion") {
      systemPrompt =
        "Kamu adalah Orion, AI yang detail dan analitis. Jawab secara terstruktur dan logis.";
    }

    const finalMessages = [
      {
        role: "system",
        content: systemPrompt
      },
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
          messages: finalMessages,
          temperature: 0.7,
          max_tokens: 2048
        })
      }
    );

    const data = await response.json();

    // Error dari Groq
    if (!response.ok) {
      console.error("Groq Error:", data);

      if (response.status === 429) {
        return res.status(429).json({
          error: "Rate limit Groq tercapai. Coba lagi beberapa saat."
        });
      }

      return res.status(response.status).json({
        error:
          data?.error?.message ||
          "Groq API mengalami error"
      });
    }

    const reply = data?.choices?.[0]?.message?.content;

    if (!reply) {
      return res.status(500).json({
        error: "Groq tidak memberikan respons"
      });
    }

    return res.status(200).json({
      reply: reply,
      model: data.model || "llama-3.3-70b-versatile",
      usage: data.usage || null
    });

  } catch (error) {
    console.error("Server Error:", error);

    return res.status(500).json({
      error: "Terjadi kesalahan pada server"
    });
  }
}
