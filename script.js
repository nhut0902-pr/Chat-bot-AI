// script.js - PHIÊN BẢN GỠ LỖI
document.addEventListener('DOMContentLoaded', () => {
    const chatForm = document.getElementById('chat-form');
    const userInput = document.getElementById('user-input');
    const chatBox = document.getElementById('chat-box');
    const loadingIndicator = document.getElementById('loading-indicator');
    const newChatBtn = document.getElementById('new-chat-btn');
    let conversationHistory = [];

    const addMessageToChatBox = (htmlContent, sender) => {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', `${sender}-message`);
        const avatarSrc = sender === 'bot' ? 'https://ssl.gstatic.com/chat/ui/v1/bot_avatar_42.svg' : 'https://i.pravatar.cc/40?u=user';
        messageElement.innerHTML = `<img src="${avatarSrc}" alt="avatar" class="avatar"><div class="message-content">${htmlContent}</div>`;
        chatBox.appendChild(messageElement);
        chatBox.scrollTop = chatBox.scrollHeight;
        return messageElement;
    };

    const startNewChat = () => {
        chatBox.innerHTML = '';
        conversationHistory = [];
        addMessageToChatBox(marked.parse("Chào bạn! Tôi là GemBot Pro."), 'bot');
    };
    newChatBtn.addEventListener('click', startNewChat);

    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const userMessage = userInput.value.trim();
        if (!userMessage) return;

        addMessageToChatBox(marked.parse(userMessage), 'user');
        const promptParts = [{ text: userMessage }];
        userInput.value = '';
        loadingIndicator.style.display = 'flex';
        chatBox.scrollTop = chatBox.scrollHeight;

        try {
            const response = await fetch('/.netlify/functions/gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: promptParts, history: conversationHistory })
            });

            loadingIndicator.style.display = 'none';

            if (!response.ok) {
                // Đọc lỗi dạng text từ backend và ném ra
                const errorText = await response.text();
                throw new Error(errorText);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullBotMessage = "";
            let botMessageElement = addMessageToChatBox("...", 'bot');
            const contentDiv = botMessageElement.querySelector('.message-content');

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                fullBotMessage += decoder.decode(value, { stream: true });
                contentDiv.innerHTML = marked.parse(fullBotMessage);
            }

            conversationHistory.push({ role: "user", parts: promptParts });
            conversationHistory.push({ role: "model", parts: [{ text: fullBotMessage }] });

        } catch (error) {
            // QUAN TRỌNG: Hiển thị lỗi chi tiết ra màn hình
            console.error('LOI O CLIENT:', error);
            loadingIndicator.style.display = 'none';
            const errorMessageHTML = `<p>Đã xảy ra lỗi. Thông tin gỡ lỗi:</p><pre style="white-space: pre-wrap; word-wrap: break-word;">${error.message}</pre>`;
            addMessageToChatBox(errorMessageHTML, 'bot');
        }
    });

    // Các phần khác giữ nguyên (theme, file upload...)
    // Nhưng tạm thời lược bỏ để tập trung vào lỗi chính
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const applyTheme = (theme) => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        const icon = theme === 'dark' ? 'sun' : 'moon';
        themeToggleBtn.innerHTML = `<i data-feather="${icon}"></i>`;
        feather.replace();
    };
    themeToggleBtn.addEventListener('click', () => {
        const newTheme = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
        applyTheme(newTheme);
    });
    const savedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(savedTheme);
    feather.replace();
    startNewChat();
});
