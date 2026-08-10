export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Data pesan tidak valid.' });
    }

    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.AI_API_KEY}`
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [
                    { 
                        role: 'system', 
                        content: 'Kamu adalah Procyon. Nama kamu diambil dari sebuah bintang. Kamu adalah AI yang cerdas, andal dalam coding, dan membantu tugas harian secara ringkas dan jelas.' 
                    },
                    ...messages
                ]
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error?.message || 'Gagal terhubung ke API Groq');
        }

        res.status(200).json({ reply: data.choices[0].message.content });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
