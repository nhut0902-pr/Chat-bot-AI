// script.js - THE FINAL, ROBUST VERSION
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements (No changes here) ---
    const chatForm = document.getElementById('chat-form');
    const userInput = document.getElementById('user-input');
    const chatBox = document.getElementById('chat-box');
    const loadingIndicator = document.getElementById('loading-indicator');
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const newChatBtn = document.getElementById('new-chat-btn');
    const fileInput = document.getElementById('file-input');
    const imagePreviewContainer = document.getElementById('image-preview-container');

    // --- State (No changes here) ---
    let conversationHistory = [];
    let currentImage = null;

    // --- Utility Functions (No changes here) ---
    const fileToGenerativePart = async (file) => {
        const base64EncodedDataPromise = new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result.split(',')[1]);
            reader.readAsDataURL(file);
        });
        return { inlineData: { data: await base64EncodedDataPromise, mimeType: file.type } };
    };

    // --- Theme Management (No changes here) ---
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

    // --- Chat UI Functions (No changes here) ---
    const addMessageToChatBox = (message, sender) => {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', `${sender}-message`);
        const avatarSrc = sender === 'bot' ? 'https://ssl.gstatic.com/chat/ui/v1/bot_avatar_42.svg' : 'https://i.pravatar.cc/40?u=user';
        const content = marked.parse(message || " ");
        messageElement.innerHTML = `<img src="${avatarSrc}" alt="${sender} avatar" class="avatar"><div class="message-content">${content}</div>`;
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

    // --- Form & Input Handling (No changes here) ---
    userInput.addEventListener('input', () => { userInput.style.height = 'auto'; userInput.style.height = (userInput.scrollHeight) + 'px'; });
    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            currentImage = await fileToGenerativePart(file);
            imagePreviewContainer.innerHTML = `<img src="${URL.createObjectURL(file)}" alt="Image preview"><button class="remove-img-btn">×</button>`;
            imagePreviewContainer.querySelector('.remove-img-btn').addEventListener('click', () => { currentImage = null; imagePreviewContainer.innerHTML = ''; fileInput.value = ''; });
        }
    });

    // --- MAIN SUBMIT LOGIC ---
    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const userMessage = userInput.value.trim();
        if (!userMessage && !currentImage) return;

        addMessageToChatBox(userMessage || "[Đã gửi 1 ảnh]", 'user');
        const promptParts = [];
        if (currentImage) promptParts.push(currentImage);
        if (userMessage) promptParts.push({ text: userMessage });
        
        userInput.value = ''; userInput.style.height = 'auto'; imagePreviewContainer.innerHTML = '';
        loadingIndicator.style.display = 'flex'; chatBox.scrollTop = chatBox.scrollHeight;

        // ===================================================================
        // FINAL AND ROBUST ERROR HANDLING LOGIC STARTS HERE
        // ===================================================================
        try {
            const response = await fetch('/.netlify/functions/gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: promptParts, history: conversationHistory })
            });

            // If the response is NOT OK, handle the error and exit
            if (!response.ok) {
                // Read the response body as text ONCE.
                const errorText = await response.text();
                // Throw an error with the text content, which will be caught below.
                throw new Error(errorText || `Server returned status ${response.status}`);
            }

            // If we reach here, the response is OK. Proceed with streaming.
            loadingIndicator.style.display = 'none';

            if (!response.body) {
                throw new Error("Response from server is OK but has no body.");
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
            
            contentDiv.insertAdjacentHTML('beforeend', `<div class="message-actions"><button class="copy-btn" title="Sao chép"><i data-feather="copy"></i></button></div>`);
            feather.replace();
            
            const userHistoryPart = { role: "user", parts: promptParts };
            conversationHistory.push(userHistoryPart);
            conversationHistory.push({ role: "model", parts: [{ text: fullBotMessage }] });
            currentImage = null;

        } catch (error) {
            console.error('An error occurred:', error);
            loadingIndicator.style.display = 'none';
            addMessageToChatBox(`Rất tiếc, đã có lỗi xảy ra: ${error.message}`, 'bot');
        }
        // ===================================================================
        // FINAL AND ROBUST ERROR HANDLING LOGIC ENDS HERE
        // ===================================================================
    });

    // --- Event Delegation (No changes here) ---
    chatBox.addEventListener('click', (e) => {
        const copyBtn = e.target.closest('.copy-btn');
        if (copyBtn) {
            const messageContent = copyBtn.closest('.message-content').innerText;
            navigator.clipboard.writeText(messageContent).then(() => {
                copyBtn.innerHTML = `<i data-feather="check"></i>`; feather.replace();
                setTimeout(() => { copyBtn.innerHTML = `<i data-feather="copy"></i>`; feather.replace(); }, 2000);
            });
        }
    });

    // --- Initial Setup (No changes here) ---
    feather.replace();
    startNewChat();
});
