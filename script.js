// script.js - PHIÊN BẢN CUỐI CÙNG - SỬA LỖI XỬ LÝ ERROR
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const chatForm = document.getElementById('chat-form');
    const userInput = document.getElementById('user-input');
    const chatBox = document.getElementById('chat-box');
    const loadingIndicator = document.getElementById('loading-indicator');
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const newChatBtn = document.getElementById('new-chat-btn');
    const fileInput = document.getElementById('file-input');
    const imagePreviewContainer = document.getElementById('image-preview-container');

    // --- State ---
    let conversationHistory = [];
    let currentImage = null;

    // --- Utility Functions ---
    const fileToGenerativePart = async (file) => {
        const base64EncodedDataPromise = new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result.split(',')[1]);
            reader.readAsDataURL(file);
        });
        return { inlineData: { data: await base64EncodedDataPromise, mimeType: file.type } };
    };

    // --- Theme Management ---
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

    // --- Chat Functions ---
    const addMessageToChatBox = (message, sender) => {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', `${sender}-message`);
        const avatarSrc = sender === 'bot' ? 'https://ssl.gstatic.com/chat/ui/v1/bot_avatar_42.svg' : 'https://i.pravatar.cc/40?u=user';
        
        const content = marked.parse(message || ""); // Đảm bảo message không phải null/undefined
        
        messageElement.innerHTML = `
            <img src="${avatarSrc}" alt="${sender} avatar" class="avatar">
            <div class="message-content">
                ${content}
                ${sender === 'bot' ? `<div class="message-actions"><button class="copy-btn" title="Sao chép"><i data-feather="copy"></i></button></div>` : ''}
            </div>
        `;
        chatBox.appendChild(messageElement);
        feather.replace();
        chatBox.scrollTop = chatBox.scrollHeight;
        return messageElement;
    };

    const startNewChat = () => {
        chatBox.innerHTML = '';
        conversationHistory = [];
        currentImage = null;
        imagePreviewContainer.innerHTML = '';
        addMessageToChatBox("Chào bạn! Tôi là GemBot Pro. Bạn có thể hỏi tôi hoặc tải ảnh lên để tôi phân tích.", 'bot');
    };
    newChatBtn.addEventListener('click', startNewChat);

    // --- Form & Input Handling ---
    userInput.addEventListener('input', () => {
        userInput.style.height = 'auto';
        userInput.style.height = (userInput.scrollHeight) + 'px';
    });

    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            currentImage = await fileToGenerativePart(file);
            imagePreviewContainer.innerHTML = `<img src="${URL.createObjectURL(file)}" alt="Image preview"><button class="remove-img-btn">×</button>`;
            imagePreviewContainer.querySelector('.remove-img-btn').addEventListener('click', () => {
                currentImage = null;
                imagePreviewContainer.innerHTML = '';
                fileInput.value = '';
            });
        }
    });

    // --- MAIN LOGIC ---
    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const userMessage = userInput.value.trim();
        if (!userMessage && !currentImage) return;

        addMessageToChatBox(userMessage || "[Phân tích ảnh]", 'user');
        userInput.value = '';
        userInput.style.height = 'auto';
        imagePreviewContainer.innerHTML = '';
        loadingIndicator.style.display = 'flex';
        chatBox.scrollTop = chatBox.scrollHeight;

        try {
            const promptParts = [userMessage];
            if (currentImage) {
                promptParts.unshift(currentImage);
            }
            
            const response = await fetch('/.netlify/functions/gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: promptParts, history: conversationHistory })
            });

            loadingIndicator.style.display = 'none';

            if (!response.ok) {
                // SỬA LỖI Ở ĐÂY: Đọc lỗi như text thay vì json
                const errorText = await response.text(); 
                throw new Error(errorText || `Lỗi từ server: ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullBotMessage = "";
            let botMessageElement = addMessageToChatBox("...", 'bot');

            while (true) {
                const { value, done } = await reader.read();
                if (done) {
                    break;
                }
                fullBotMessage += decoder.decode(value, { stream: true });
                // Cập nhật nội dung mà không cần parse lại toàn bộ HTML
                const contentDiv = botMessageElement.querySelector('.message-content');
                if (contentDiv) {
                    contentDiv.innerHTML = marked.parse(fullBotMessage);
                }
            }
            
            // Render lại icon copy sau khi stream kết thúc
            const actionDiv = botMessageElement.querySelector('.message-actions');
            if (actionDiv) {
                 actionDiv.innerHTML = `<button class="copy-btn" title="Sao chép"><i data-feather="copy"></i></button>`;
                 feather.replace();
            }
            
            conversationHistory.push({ role: "user", parts: promptParts });
            conversationHistory.push({ role: "model", parts: [{ text: fullBotMessage }] });

            currentImage = null;

        } catch (error) {
            console.error('Lỗi ở phía client:', error);
            loadingIndicator.style.display = 'none';
            addMessageToChatBox(`Rất tiếc, đã có lỗi xảy ra.`, 'bot');
        }
    });

    // --- Event Delegation for copy ---
    chatBox.addEventListener('click', (e) => {
        const copyBtn = e.target.closest('.copy-btn');
        if (copyBtn) {
            const messageContent = copyBtn.closest('.message-content').innerText;
            navigator.clipboard.writeText(messageContent).then(() => {
                copyBtn.innerHTML = `<i data-feather="check"></i>`;
                feather.replace();
                setTimeout(() => {
                    copyBtn.innerHTML = `<i data-feather="copy"></i>`;
                    feather.replace();
                }, 2000);
            });
        }
    });

    feather.replace();
    startNewChat();
});
