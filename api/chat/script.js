const chatBox = document.getElementById('chat-box');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const newChatBtn = document.getElementById('new-chat-btn');

// Fungsi otomatis menyesuaikan tinggi textarea
userInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight < 200 ? this.scrollHeight : 200) + 'px';
});

// Kirim dengan tombol Enter (tanpa shift)
userInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

sendBtn.addEventListener('click', sendMessage);

newChatBtn.addEventListener('click', () => {
    chatBox.innerHTML = `
        <div class="message-wrapper ai">
          <div class="avatar"><i class="fas fa-star"></i></div>
          <div class="message-content">Halo! Saya Procyon. Ada yang bisa saya bantu hari ini?</div>
        </div>
    `;
});

async function sendMessage() {
    const text = userInput.value.trim();
    if (!text) return;

    // Tambahkan pesan user ke UI
    appendMessage(text, 'user');
    userInput.value = '';
    userInput.style.height = 'auto';
    sendBtn.disabled = true;

    // Siapkan wadah untuk pesan balasan AI
    const aiMessageDiv = appendMessage('...', 'ai');

    try {
        // PERHATIKAN: Kita fetch ke file Vercel lokal kita, bukan ke eksternal API!
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message: text })
        });

        const data = await response.json();

        if (response.ok) {
            aiMessageDiv.textContent = data.reply;
        } else {
            aiMessageDiv.textContent = `Error: ${data.error || 'Terjadi kesalahan pada server.'}`;
        }
    } catch (error) {
        aiMessageDiv.textContent = 'Gagal menghubungi server Vercel. Pastikan server berjalan.';
    } finally {
        sendBtn.disabled = false;
        chatBox.scrollTop = chatBox.scrollHeight;
    }
}

function appendMessage(text, sender) {
    const wrapper = document.createElement('div');
    wrapper.classList.add('message-wrapper', sender);

    const avatar = document.createElement('div');
    avatar.classList.add('avatar');
    
    if (sender === 'user') {
        avatar.innerHTML = '<i class="fas fa-user"></i>';
    } else {
        avatar.innerHTML = '<i class="fas fa-star"></i>';
    }

    const content = document.createElement('div');
    content.classList.add('message-content');
    content.textContent = text;

    wrapper.appendChild(avatar);
    wrapper.appendChild(content);
    chatBox.appendChild(wrapper);
    
    chatBox.scrollTop = chatBox.scrollHeight;
    
    return content; // Return content supaya bisa di-update (untuk loading state)
}
