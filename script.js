document.addEventListener('DOMContentLoaded', () => {
    // --- AN TOÀN HÓA VIỆC LẤY DOM ELEMENTS ---
    // Bằng cách này, nếu một element không tồn tại, nó sẽ là null thay vì gây lỗi ngay lập tức
    const dashboard = document.getElementById('dashboard');
    const toggleDashboardBtn = document.getElementById('toggle-dashboard-btn');
    const historyList = document.getElementById('history-list');
    const newChatBtn = document.getElementById('new-chat-btn');
    const chatBox = document.getElementById('chat-box');
    const chatForm = document.getElementById('chat-form');
    const userInput = document.getElementById('user-input');
    const toolSelector = document.querySelector('.tool-selector');

    // Kiểm tra xem các element cốt lõi có tồn tại không
    if (!chatBox || !chatForm || !userInput || !toolSelector) {
        console.error("Lỗi nghiêm trọng: Không tìm thấy các thành phần giao diện cốt lõi!");
        return; // Dừng thực thi nếu thiếu các phần tử cơ bản
    }

    // --- STATE MANAGEMENT ---
    let allChats = {};
    let activeChatId = null;
    let activeTool = 'chat'; // Công cụ mặc định

    // --- TOOL SELECTOR LOGIC ---
    toolSelector.addEventListener('click', (e) => {
        const clickedButton = e.target.closest('.tool-btn');
        if (!clickedButton) return;

        document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
        clickedButton.classList.add('active');
        
        activeTool = clickedButton.dataset.tool;
        updatePlaceholder();
    });

    const updatePlaceholder = () => {
        const placeholders = {
            web_search: "Nhập nội dung cần tìm kiếm trên web...",
            image_generation: "Mô tả hình ảnh bạn muốn tạo...",
            chat: "Đặt câu hỏi cho gia sư...",
        };
        userInput.placeholder = placeholders[activeTool] || placeholders.chat;
    };

    // --- DASHBOARD & HISTORY MANAGEMENT ---
    const renderDashboard = () => {
        if (!historyList) return;
        historyList.innerHTML = '';
        Object.keys(allChats).sort((a, b) => b - a).forEach(chatId => {
            const historyItem = document.createElement('div');
            historyItem.classList.add('history-item');
            if (chatId === activeChatId) historyItem.classList.add('active');
            const firstUserMessage = allChats[chatId]?.find(m => m.role === 'user');
            historyItem.textContent = firstUserMessage ? firstUserMessage.parts[0].text.substring(0, 25) + '...' : 'Trò chuyện mới';
            historyItem.dataset.chatId = chatId;
            historyList.appendChild(historyItem);
        });
    };

    const saveChatsToStorage = () => localStorage.setItem('allGiaSuAIChats', JSON.stringify(allChats));
    const loadChatsFromStorage = () => {
        try {
            const storedChats = localStorage.getItem('allGiaSuAIChats');
            if (storedChats) {
                allChats = JSON.parse(storedChats);
                activeChatId = Object.keys(allChats).sort((a, b) => b - a)[0] || null;
            }
        } catch (e) {
            console.error("Không thể load lịch sử chat:", e);
            allChats = {};
            activeChatId = null;
        }
    };
    
    const loadChat = (chatId) => {
        activeChatId = chatId;
        chatBox.innerHTML = '';
        const currentChat = allChats[activeChatId];
        if (!currentChat || currentChat.length === 0) {
            addMessageToBox('model', "Chào bạn! Tôi là Gia sư AI. Hãy chọn một công cụ và bắt đầu nhé!", false);
        } else {
            currentChat.forEach(msg => addMessageToBox(msg.role, msg.parts[0].text, false));
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
            allChats[activeChatId].push({ role: sender, parts: [{ text }] });
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
    const callBackend = async (endpoint, payload) => {
        showTypingIndicator();
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Lỗi không xác định từ server");
            return data;
        } catch (error) {
            console.error(`Lỗi khi gọi ${endpoint}:`, error);
            addMessageToBox('model', `Xin lỗi, có lỗi: ${error.message}`);
            return null;
        }
    };
    
    // --- MAIN EVENT LISTENERS ---
    if(toggleDashboardBtn) {
        toggleDashboardBtn.addEventListener('click', () => dashboard?.classList.toggle('collapsed'));
    }
    if(newChatBtn) {
        newChatBtn.addEventListener('click', startNewChat);
    }
    if(historyList){
        historyList.addEventListener('click', (e) => {
            const item = e.target.closest('.history-item');
            if (item?.dataset.chatId) loadChat(item.dataset.chatId);
        });
    }

    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const userMessage = userInput.value.trim();
        if (!userMessage) return;

        let responseData;
        switch (activeTool) {
            case 'web_search':
                addMessageToBox('user', `[Tìm kiếm]: ${userMessage}`);
                responseData = await callBackend('/.netlify/functions/callGemini', { history: allChats[activeChatId], payload: { type: 'web_search', message: userMessage } });
                if (responseData) addMessageToBox('model', responseData.response);
                break;
            case 'image_generation':
                addMessageToBox('user', `[Tạo ảnh]: ${userMessage}`);
                responseData = await callBackend('/.netlify/functions/generateImage', { prompt: userMessage });
                if (responseData) addMessageToBox('model', `<img src="${responseData.imageUrl}" alt="${userMessage}" class="generated-image">`);
                break;
            case 'chat':
            default:
                addMessageToBox('user', userMessage);
                responseData = await callBackend('/.netlify/functions/callGemini', { history: allChats[activeChatId], payload: { type: 'chat', message: userMessage } });
                if (responseData) addMessageToBox('model', responseData.response);
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
    updatePlaceholder();
});
