document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const dashboard = document.querySelector('.dashboard');
    const toggleDashboardBtn = document.getElementById('toggle-dashboard-btn');
    const historyList = document.getElementById('history-list');
    const newChatBtn = document.getElementById('new-chat-btn');
    const chatBox = document.getElementById('chat-box');
    const chatForm = document.getElementById('chat-form');
    const userInput = document.getElementById('user-input');
    const webSearchBtn = document.getElementById('web-search-btn');

    // Canvas Elements
    const canvasModal = document.getElementById('canvas-modal');
    const openCanvasBtn = document.getElementById('open-canvas-btn');
    const closeCanvasBtn = document.querySelector('.modal .close-btn');
    const canvas = document.getElementById('drawing-canvas');
    const ctx = canvas.getContext('2d');
    const clearCanvasBtn = document.getElementById('clear-canvas-btn');
    const sendDrawingBtn = document.getElementById('send-drawing-btn');
    
    // State Management
    let allChats = {};
    let activeChatId = null;
    let currentContext = ""; // Kiến thức từ file/web/youtube

    // --- DASHBOARD & HISTORY MANAGEMENT ---

    const renderDashboard = () => {
        historyList.innerHTML = '';
        Object.keys(allChats).sort((a, b) => b - a).forEach(chatId => {
            const historyItem = document.createElement('div');
            historyItem.classList.add('history-item');
            if (chatId === activeChatId) {
                historyItem.classList.add('active');
            }
            // Lấy tin nhắn đầu tiên của user làm tiêu đề
            const firstUserMessage = allChats[chatId].find(m => m.role === 'user');
            historyItem.textContent = firstUserMessage ? firstUserMessage.parts[0].text : 'Cuộc trò chuyện mới';
            historyItem.dataset.chatId = chatId;
            historyList.appendChild(historyItem);
        });
    };

    const saveChatsToStorage = () => {
        localStorage.setItem('allGiaSuAIChats', JSON.stringify(allChats));
    };

    const loadChatsFromStorage = () => {
        const storedChats = localStorage.getItem('allGiaSuAIChats');
        if (storedChats) {
            allChats = JSON.parse(storedChats);
            // Lấy chat gần nhất làm active chat
            activeChatId = Object.keys(allChats).sort((a, b) => b - a)[0] || null;
        }
    };
    
    const loadChat = (chatId) => {
        activeChatId = chatId;
        chatBox.innerHTML = '';
        allChats[activeChatId].forEach(msg => addMessageToBox(msg.role, msg.parts[0].text, false));
        renderDashboard();
    };

    const startNewChat = () => {
        const newChatId = Date.now().toString();
        const welcomeMessage = "Chào bạn! Tôi là Gia sư AI. Hãy bắt đầu một chủ đề mới nhé!";
        allChats[newChatId] = [{ role: 'model', parts: [{ text: welcomeMessage }] }];
        activeChatId = newChatId;
        chatBox.innerHTML = '';
        addMessageToBox('model', welcomeMessage, false);
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

        if (isNew && activeChatId) {
            allChats[activeChatId].push({ role: sender, parts: [{ text: text }] });
            saveChatsToStorage();
            // Cập nhật tiêu đề trên dashboard nếu đây là tin nhắn đầu tiên
            if (allChats[activeChatId].filter(m => m.role === 'user').length === 1) {
                renderDashboard();
            }
        }
    };

    const showTypingIndicator = () => {
        const indicator = document.createElement('div');
        indicator.classList.add('message', 'bot-message', 'typing-indicator');
        indicator.innerHTML = '<span></span><span></span><span></span>';
        chatBox.appendChild(indicator);
        chatBox.scrollTop = chatBox.scrollHeight;
    };

    // --- API & BOT RESPONSE ---
    
    const getBotResponse = async (payload) => {
        if (!activeChatId) {
            alert("Vui lòng bắt đầu một cuộc trò chuyện mới!");
            return;
        }
        
        showTypingIndicator();
        try {
            const response = await fetch('/.netlify/functions/callGemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!response.ok) throw new Error(`Lỗi server: ${response.statusText}`);
            
            const data = await response.json();
            addMessageToBox('model', data.response);

        } catch (error) {
            console.error('Lỗi khi gọi Gemini:', error);
            addMessageToBox('model', 'Xin lỗi, tôi đang gặp sự cố. Vui lòng thử lại sau.');
        }
    };
    
    // --- CANVAS LOGIC ---
    let drawing = false;
    const startPosition = (e) => { drawing = true; draw(e); };
    const endPosition = () => { drawing = false; ctx.beginPath(); };
    const draw = (e) => {
        if (!drawing) return;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX ? e.clientX - rect.left : e.touches[0].clientX - rect.left;
        const y = e.clientY ? e.clientY - rect.top : e.touches[0].clientY - rect.top;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#333';
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y);
    };

    // --- EVENT LISTENERS ---

    toggleDashboardBtn.addEventListener('click', () => dashboard.classList.toggle('collapsed'));
    newChatBtn.addEventListener('click', startNewChat);
    historyList.addEventListener('click', (e) => {
        const item = e.target.closest('.history-item');
        if (item && item.dataset.chatId) {
            loadChat(item.dataset.chatId);
        }
    });

    chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const userMessage = userInput.value.trim();
        if (!userMessage) return;
        addMessageToBox('user', userMessage);
        getBotResponse({
            history: allChats[activeChatId],
            context: currentContext,
            promptType: 'chat',
        });
        userInput.value = '';
    });

    webSearchBtn.addEventListener('click', () => {
        const userMessage = userInput.value.trim();
        if (!userMessage) return;
        addMessageToBox('user', `[Tìm kiếm web]: ${userMessage}`);
        getBotResponse({
            history: allChats[activeChatId],
            promptType: 'web_search',
            message: userMessage, // Gửi message riêng để biết cần tìm gì
        });
        userInput.value = '';
    });

    // Canvas Events
    openCanvasBtn.addEventListener('click', () => canvasModal.style.display = 'block');
    closeCanvasBtn.addEventListener('click', () => canvasModal.style.display = 'none');
    clearCanvasBtn.addEventListener('click', () => ctx.clearRect(0, 0, canvas.width, canvas.height));
    canvas.addEventListener('mousedown', startPosition);
    canvas.addEventListener('mouseup', endPosition);
    canvas.addEventListener('mousemove', draw);
    // Touch events for mobile
    canvas.addEventListener('touchstart', startPosition);
    canvas.addEventListener('touchend', endPosition);
    canvas.addEventListener('touchmove', draw);


    sendDrawingBtn.addEventListener('click', () => {
        const userMessage = userInput.value.trim() || "Hãy phân tích hình ảnh này.";
        const imageData = canvas.toDataURL('image/jpeg');
        
        addMessageToBox('user', `${userMessage} <br> <img src="${imageData}" width="150" alt="Bản vẽ của người dùng">`);
        
        getBotResponse({
            history: allChats[activeChatId],
            promptType: 'image_chat',
            message: userMessage,
            imageData: imageData.split(',')[1], // Chỉ gửi dữ liệu base64
        });
        
        userInput.value = '';
        canvasModal.style.display = 'none';
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    });

    // --- INITIALIZATION ---
    loadChatsFromStorage();
    if (activeChatId) {
        loadChat(activeChatId);
    } else {
        startNewChat();
    }
});
