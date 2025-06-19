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
    let currentImage = null; // To hold the Base64 image string

    // --- Utility Functions ---
    // Function to convert file to Base64
    const fileToGenerativePart = async (file) => {
        const base64EncodedDataPromise = new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result.split(',')[1]);
            reader.readAsDataURL(file);
        });
        return {
            inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
        };
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

    // Load saved theme
    const savedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(savedTheme);


    // --- Chat Functions ---
    const addMessageToChatBox = (message, sender, isStreaming = false) => {
        let messageElement = document.createElement('div');
        messageElement.classList.add('message', `${sender}-message`);

        const avatarSrc = sender === 'bot' ? 'https://ssl.gstatic.com/chat/ui/v1/bot_avatar_42.svg' : 'https://i.pravatar.cc/40?u=user';
        
        // Use marked.js to parse Markdown content
        const parsedMessage = marked.parse(message);

        messageElement.innerHTML = `
            <img src="${avatarSrc}" alt="${sender} avatar" class="avatar">
            <div class="message-content">
                ${parsedMessage}
                ${sender === 'bot' ? `
                    <div class="message-actions">
                        <button class="copy-btn" title="Sao chép"><i data-feather="copy"></i></button>
                    </div>` : ''}
            </div>
        `;

        if (isStreaming) {
            const lastBotMessage = chatBox.querySelector('.bot-message:last-child .message-content');
            if (lastBotMessage) {
                lastBotMessage.innerHTML = parsedMessage;
                messageElement = lastBotMessage.parentElement; // Don't create new element
            } else {
                 chatBox.appendChild(messageElement);
            }
        } else {
             chatBox.appendChild(messageElement);
        }

        feather.replace(); // To render icons on new messages
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
        // Auto-resize textarea
        userInput.style.height = 'auto';
        userInput.style.height = (userInput.scrollHeight) + 'px';
    });

    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            currentImage = await fileToGenerativePart(file);
            imagePreviewContainer.innerHTML = `
                <img src="${URL.createObjectURL(file)}" alt="Image preview">
                <button class="remove-img-btn">×</button>
            `;
            imagePreviewContainer.querySelector('.remove-img-btn').addEventListener('click', () => {
                currentImage = null;
                imagePreviewContainer.innerHTML = '';
                fileInput.value = ''; // Reset file input
            });
        }
    });

    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const userMessage = userInput.value.trim();
        if (!userMessage && !currentImage) return;

        // Display user message
        let userPrompt = userMessage;
        if (currentImage) {
            // Add a placeholder in the UI if there's an image but no text
            addMessageToChatBox(userPrompt || "[Phân tích ảnh]", 'user');
        } else {
            addMessageToChatBox(userPrompt, 'user');
        }
        
        userInput.value = '';
        userInput.style.height = 'auto';
        imagePreviewContainer.innerHTML = ''; // Clear preview
        loadingIndicator.style.display = 'flex';
        chatBox.scrollTop = chatBox.scrollHeight;

        // --- API Call with Streaming ---
        try {
            const promptParts = [userPrompt];
            if (currentImage) {
                promptParts.unshift(currentImage);
                // Reset for next turn
                currentImage = null; 
            }
            
            // Call Netlify Function
            const response = await fetch('/.netlify/functions/gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: promptParts,
                    history: conversationHistory
                }),
            });

            if (!response.ok) {
                throw new Error(`Server error: ${response.statusText}`);
            }

            loadingIndicator.style.display = 'none';

            // Handle streaming response
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullBotMessage = "";
            let botMessageElement = null;

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                
                fullBotMessage += decoder.decode(value, { stream: true });
                if (!botMessageElement) {
                    botMessageElement = addMessageToChatBox("...", 'bot');
                }
                
                // Update existing message element with new content
                botMessageElement.querySelector('.message-content').innerHTML = marked.parse(fullBotMessage);
                feather.replace();
                chatBox.scrollTop = chatBox.scrollHeight;
            }

            // Update history after the full message is received
            conversationHistory.push({ role: "user", parts: promptParts });
            conversationHistory.push({ role: "model", parts: [{ text: fullBotMessage }] });

        } catch (error) {
            console.error('API call failed:', error);
            loadingIndicator.style.display = 'none';
            addMessageToChatBox('Rất tiếc, đã có lỗi xảy ra. Vui lòng thử lại.', 'bot');
        }
    });

    // Event delegation for copy buttons
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

    // Initialize Feather Icons
    feather.replace();
    // Start with the initial welcome message
    startNewChat();
});
