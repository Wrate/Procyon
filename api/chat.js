export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Pesan kosong' });

    try {
        // Endpoint API Groq
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.AI_API_KEY}` // Masukkan Groq API Key di Vercel Env
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile', // <--- MODEL TERBAIK UNTUK GROQ
                messages: [
                    { 
                        role: 'system', 
                        content: 'Kamu adalah Procyon. Nama kamu diambil dari sebuah bintang. Kamu adalah AI yang cerdas, membantu, ringkas, serta andal dalam coding dan jawaban umum. Jangan sebutkan kamu buatan Meta/Groq, cukup identifikasi dirimu sebagai Procyon.' 
                    },
                    { role: 'user', content: message }
                ]
            })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || 'Gagal ke API Groq');

        res.status(200).json({ reply: data.choices[0].message.content });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
