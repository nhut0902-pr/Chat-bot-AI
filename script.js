document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const dashboard = document.getElementById('dashboard');
    const toggleDashboardBtn = document.getElementById('toggle-dashboard-btn');
    const historyList = document.getElementById('history-list');
    const newChatBtn = document.getElementById('new-chat-btn');
    const chatBox = document.getElementById('chat-box');
    const chatForm = document.getElementById('chat-form');
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const toolSelector = document.querySelector('.tool-selector');
    
    // (Các DOM elements khác như Canvas có thể thêm vào đây nếu bạn giữ lại chúng)

    // State Management
    let allChats = {};
    let activeChatId = null;
    let activeTool = 'chat'; // Công cụ mặc định là trò chuyện

    // --- TOOL SELECTOR LOGIC ---
    toolSelector.addEventListener('click', (e) => {
        const clickedButton = e.target.closest('.tool-btn');
        if (!clickedButton) return;

        // Cập nhật giao diện nút
        document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
        clickedButton.classList.add('active');
        
        // Cập nhật state và placeholder
        activeTool = clickedButton.dataset.tool;
        updatePlaceholder();
    });

    const updatePlaceholder = () => {
        switch (activeTool) {
            case 'web_search':
                userInput.placeholder = "Nhập nội dung cần tìm kiếm trên web...";
                break;
            case 'image_generation':
                userInput.placeholder = "Mô tả hình ảnh bạn muốn tạo...";
                break;
            case 'chat':
            default:
                userInput.placeholder = "Đặt câu hỏi cho gia sư...";
                break;
        }
    };

    // --- DASHBOARD & HISTORY MANAGEMENT ---
    const renderDashboard = () => {
        historyList.innerHTML = '';
        Object.keys(allChats).sort((a, b) => b - a).forEach(chatId => {
            const historyItem = document.createElement('div');
            historyItem.classList.add('history-item');
            if (chatId === activeChatId) historyItem.classList.add('active');
            const firstUserMessage = allChats[chatId]?.find(m => m.role === 'user');
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
        if (!allChats[activeChatId] || allChats[activeChatId].length === 0) {
            addMessageToBox('model', "Chào bạn! Tôi là Gia sư AI. Hãy chọn một công cụ và bắt đầu nhé!", false);
        } else {
            allChats[activeChatId].forEach(msg => addMessageToBox(msg.role, msg.parts[0].text, false));
        }
        renderDashboard();
    };

    const startNewChat = () => {
        const newChatId = Date.now().toString();
        allChats[newChatId] = [];
        activeChatId = newChatId;
        chatBox.innerHTML = '';
        addMessageToBox('model', "Chào bạn! Tôi là Gia sư AI. Hãy chọn một công cụ và bắt đầu nhé!", false);
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
        
        if (isNew && activeChatId && allChats[activeChatId] !== undefined) {
            allChats[activeChatId].push({ role: sender, parts: [{ text: text }] });
            saveChatsToStorage();
            if (sender === 'user' && allChats[activeChatId].filter(m => m.role === 'user').length === 1) {
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

    // --- API CALLS ---
    const getBotResponse = async (payload) => {
        if (!activeChatId) { alert("Vui lòng bắt đầu một cuộc trò chuyện mới!"); return; }
        
        showTypingIndicator();
        try {
            const response = await fetch('/.netlify/functions/callGemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ history: allChats[activeChatId], payload }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Lỗi không xác định từ server");
            addMessageToBox('model', data.response);
        } catch (error) {
            addMessageToBox('model', `Xin lỗi, có lỗi: ${error.message}`);
        }
    };
    
    const generateImage = async (prompt) => {
        showTypingIndicator();
        try {
            const response = await fetch('/.netlify/functions/generateImage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Không thể tạo ảnh");
            addMessageToBox('model', `<img src="${data.imageUrl}" alt="${prompt}" class="generated-image">`);
        } catch (error) {
            addMessageToBox('model', `Xin lỗi, có lỗi khi tạo ảnh: ${error.message}`);
        }
    };

    // --- MAIN EVENT LISTENERS ---
    toggleDashboardBtn.addEventListener('click', () => dashboard.classList.toggle('collapsed'));
    newChatBtn.addEventListener('click', startNewChat);
    historyList.addEventListener('click', (e) => {
        const item = e.target.closest('.history-item');
        if (item?.dataset.chatId) loadChat(item.dataset.chatId);
    });

    chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const userMessage = userInput.value.trim();
        if (!userMessage) return;

        // Dựa vào công cụ đang active để quyết định hành động
        switch (activeTool) {
            case 'web_search':
                addMessageToBox('user', `[Tìm kiếm]: ${userMessage}`);
                getBotResponse({ type: 'web_search', message: userMessage });
                break;
            case 'image_generation':
                addMessageToBox('user', `[Tạo ảnh]: ${userMessage}`);
                generateImage(userMessage);
                break;
            case 'chat':
            default:
                addMessageToBox('user', userMessage);
                // Với chat thông thường, không cần gửi type
                getBotResponse({ type: 'chat', message: userMessage });
                break;
        }
        userInput.value = '';
    });

    // --- INITIALIZATION ---
    loadChatsFromStorage();
    if (activeChatId && allChats[activeChatId] !== undefined) {
        loadChat(activeChatId);
    } else {
        startNewChat();
    }
    updatePlaceholder(); // Cập nhật placeholder lần đầu
});
