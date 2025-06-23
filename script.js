document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const dashboard = document.getElementById('dashboard');
    const toggleDashboardBtn = document.getElementById('toggle-dashboard-btn');
    const historyList = document.getElementById('history-list');
    const newChatBtn = document.getElementById('new-chat-btn');
    const chatBox = document.getElementById('chat-box');
    const chatForm = document.getElementById('chat-form');
    const userInput = document.getElementById('user-input');
    const sendChatBtn = document.getElementById('send-chat-btn');
    const generateImageBtn = document.getElementById('generate-image-btn');

    // Canvas Elements
    const canvasModal = document.getElementById('canvas-modal');
    const openCanvasBtn = document.getElementById('open-canvas-btn');
    const closeCanvasBtn = document.querySelector('.modal .close-btn');
    const canvas = document.getElementById('drawing-canvas');
    const ctx = canvas.getContext('2d');
    const clearCanvasBtn = document.getElementById('clear-canvas-btn');
    const sendDrawingBtn = document.getElementById('send-drawing-btn');
    
    // Voice Mode Elements
    const voiceModeBtn = document.getElementById('voice-mode-btn');

    // State Management
    let allChats = {};
    let activeChatId = null;

    // --- VOICE MODE SETUP ---
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition = null;
    let isRecording = false;
    let synth = window.speechSynthesis;

    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.lang = 'vi-VN';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onresult = (event) => {
            userInput.value = event.results[0][0].transcript;
            stopRecording();
            sendChatBtn.click(); // Tự động gửi tin nhắn chat sau khi nói xong
        };
        recognition.onerror = (event) => {
            console.error("Lỗi nhận dạng giọng nói:", event.error);
            stopRecording();
        };
        recognition.onend = () => {
            if (isRecording) stopRecording();
        };
    } else {
        voiceModeBtn.style.display = 'none';
    }

    const startRecording = () => { if (recognition) { isRecording = true; voiceModeBtn.classList.add('recording'); recognition.start(); }};
    const stopRecording = () => { if (recognition) { isRecording = false; voiceModeBtn.classList.remove('recording'); recognition.stop(); }};
    const speak = (text) => {
        if (synth.speaking) { synth.cancel(); }
        if (text) {
            const cleanText = text.replace(/[*#`~]/g, '');
            const utterThis = new SpeechSynthesisUtterance(cleanText);
            utterThis.lang = 'vi-VN';
            utterThis.onerror = (e) => console.error('Lỗi SpeechSynthesis:', e);
            synth.speak(utterThis);
        }
    };

    // --- DASHBOARD & HISTORY MANAGEMENT ---
    const renderDashboard = () => {
        historyList.innerHTML = '';
        Object.keys(allChats).sort((a, b) => b - a).forEach(chatId => {
            const historyItem = document.createElement('div');
            historyItem.classList.add('history-item');
            if (chatId === activeChatId) historyItem.classList.add('active');
            const firstUserMessage = allChats[chatId].find(m => m.role === 'user');
            historyItem.textContent = firstUserMessage ? firstUserMessage.parts[0].text : 'Trò chuyện mới';
            historyItem.dataset.chatId = chatId;
            historyList.appendChild(historyItem);
        });
    };

    const saveChatsToStorage = () => localStorage.setItem('allGiaSuAIChats', JSON.stringify(allChats));
    const loadChatsFromStorage = () => {
        const storedChats = localStorage.getItem('allGiaSuAIChats');
        if (storedChats) {
            allChats = JSON.parse(storedChats);
            activeChatId = Object.keys(allChats).sort((a, b) => b - a)[0] || null;
        }
    };
    
    const loadChat = (chatId) => {
        activeChatId = chatId;
        chatBox.innerHTML = '';
        if (allChats[activeChatId]?.length === 0) {
            addMessageToBox('model', "Chào bạn! Tôi là Gia sư AI. Hãy bắt đầu một chủ đề mới nhé!", false);
        } else {
            allChats[activeChatId]?.forEach(msg => addMessageToBox(msg.role, msg.parts[0].text, false));
        }
        renderDashboard();
    };

    const startNewChat = () => {
        const newChatId = Date.now().toString();
        allChats[newChatId] = [];
        activeChatId = newChatId;
        chatBox.innerHTML = '';
        addMessageToBox('model', "Chào bạn! Tôi là Gia sư AI. Hãy bắt đầu một chủ đề mới nhé!", false);
        saveChatsToStorage();
        renderDashboard();
    };

    // --- UI & MESSAGE FUNCTIONS ---
    const addMessageToBox = (sender, text, isNew = true) => {
        document.querySelector('.typing-indicator')?.remove();
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', sender === 'user' ? 'user-message' : 'bot-message');
        messageElement.innerHTML = text.replace(/\n/g, '<br>');
        chatBox.appendChild(messageElement);
        chatBox.scrollTop = chatBox.scrollHeight;

        if (sender === 'model' && !text.includes('<img')) speak(text);
        
        if (isNew && activeChatId && allChats[activeChatId]) {
            allChats[activeChatId].push({ role: sender, parts: [{ text: text }] });
            saveChatsToStorage();
            if (sender === 'user' && allChats[activeChatId].filter(m => m.role === 'user').length === 1) {
                renderDashboard();
            }
        }
    };

    const showTypingIndicator = () => { /* Giữ nguyên hàm này */ };

    // --- API CALLS ---
    const getBotResponse = async (userMessage) => {
        if (!activeChatId) { alert("Vui lòng bắt đầu một cuộc trò chuyện mới!"); return; }
        
        addMessageToBox('user', userMessage);
        
        showTypingIndicator();
        try {
            const response = await fetch('/.netlify/functions/callGemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ history: allChats[activeChatId] }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Lỗi không xác định");
            addMessageToBox('model', data.response);
        } catch (error) {
            addMessageToBox('model', `Xin lỗi, có lỗi xảy ra: ${error.message}`);
        }
    };
    
    const generateImage = async (prompt) => {
        addMessageToBox('user', `[Tạo ảnh]: ${prompt}`);
        showTypingIndicator();
        try {
            const response = await fetch('/.netlify/functions/generateImage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);
            addMessageToBox('model', `<img src="${data.imageUrl}" alt="${prompt}" class="generated-image">`);
        } catch (error) {
            addMessageToBox('model', `Xin lỗi, có lỗi khi tạo ảnh: ${error.message}`);
        }
    };

    // --- EVENT LISTENERS ---
    toggleDashboardBtn.addEventListener('click', () => dashboard.classList.toggle('collapsed'));
    newChatBtn.addEventListener('click', startNewChat);
    historyList.addEventListener('click', (e) => {
        const item = e.target.closest('.history-item');
        if (item?.dataset.chatId) loadChat(item.dataset.chatId);
    });

    sendChatBtn.addEventListener('click', () => {
        const userMessage = userInput.value.trim();
        if (!userMessage) return;
        getBotResponse(userMessage);
        userInput.value = '';
    });

    generateImageBtn.addEventListener('click', () => {
        const prompt = userInput.value.trim();
        if (!prompt) return;
        generateImage(prompt);
        userInput.value = '';
    });
    
    chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        sendChatBtn.click();
    });

    voiceModeBtn.addEventListener('click', () => {
        if (synth.speaking) synth.cancel(); // Dừng đọc nếu đang đọc
        if (!isRecording) startRecording();
        else stopRecording();
    });

    // Canvas Events... (giữ nguyên logic canvas)

    // --- INITIALIZATION ---
    loadChatsFromStorage();
    if (activeChatId && allChats[activeChatId]) {
        loadChat(activeChatId);
    } else {
        startNewChat();
    }
});
