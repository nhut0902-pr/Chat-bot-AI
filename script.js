document.addEventListener('DOMContentLoaded', () => {
    // --- DOM ELEMENTS ---
    const dashboard = document.getElementById('dashboard');
    const toggleDashboardBtn = document.getElementById('toggle-dashboard-btn');
    const historyList = document.getElementById('history-list');
    const newChatBtn = document.getElementById('new-chat-btn');
    const chatBox = document.getElementById('chat-box');
    const chatForm = document.getElementById('chat-form');
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const toolSelector = document.querySelector('.tool-selector');
    const fileInput = document.getElementById('file-input');

    // --- KIỂM TRA DOM CỐT LÕI ---
    if (!chatBox || !chatForm || !userInput || !toolSelector || !sendBtn) {
        console.error("CRITICAL ERROR: Core UI elements are missing. Halting execution.");
        document.body.innerHTML = "<h1>Lỗi nghiêm trọng: Giao diện không thể tải. Vui lòng kiểm tra lại file HTML.</h1>";
        return;
    }

    // --- STATE MANAGEMENT ---
    let allChats = {};
    let activeChatId = null;
    let activeTool = 'chat';
    let documentContext = "";

    // --- HELPER & UI FUNCTIONS ---
    const showTypingIndicator = () => {
        document.querySelector('.typing-indicator')?.remove();
        const indicator = document.createElement('div');
        indicator.classList.add('message', 'bot-message', 'typing-indicator');
        indicator.innerHTML = '<span></span><span></span><span></span>';
        chatBox.appendChild(indicator);
        chatBox.scrollTop = chatBox.scrollHeight;
    };

    const addMessageToBox = (sender, text, isNew = true) => {
        document.querySelector('.typing-indicator')?.remove();
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', sender === 'user' ? 'user-message' : 'bot-message');
        messageElement.innerHTML = text.replace(/\n/g, '<br>');
        chatBox.appendChild(messageElement);
        chatBox.scrollTop = chatBox.scrollHeight;

        if (isNew && activeChatId && allChats[activeChatId]) {
            allChats[activeChatId].push({ role: sender, parts: [{ text }] });
            saveChatsToStorage();
            if (sender === 'user' && allChats[activeChatId].filter(m => m.role === 'user').length === 1) {
                renderDashboard();
            }
        }
    };
    
    // --- DASHBOARD & HISTORY LOGIC ---
    const saveChatsToStorage = () => localStorage.setItem('allGiaSuAIChats', JSON.stringify(allChats));

    const loadChatsFromStorage = () => {
        try {
            const storedChats = localStorage.getItem('allGiaSuAIChats');
            allChats = storedChats ? JSON.parse(storedChats) : {};
        } catch (e) {
            console.error("Error parsing chats from localStorage. Resetting.", e);
            allChats = {};
        }
    };
    
    const renderDashboard = () => {
        if (!historyList) return;
        historyList.innerHTML = '';
        const sortedChatIds = Object.keys(allChats).sort((a, b) => b - a);
        sortedChatIds.forEach(chatId => {
            const historyItem = document.createElement('div');
            historyItem.classList.add('history-item');
            if (chatId === activeChatId) historyItem.classList.add('active');
            const firstUserMessage = allChats[chatId]?.find(m => m.role === 'user');
            const title = firstUserMessage ? firstUserMessage.parts[0].text : 'Trò chuyện mới';
            historyItem.textContent = title.substring(0, 25) + (title.length > 25 ? '...' : '');
            historyItem.dataset.chatId = chatId;
            historyList.appendChild(historyItem);
        });
    };

    const setActiveChat = (chatId) => {
        activeChatId = chatId;
        documentContext = ""; // Reset context file khi đổi chat
        chatBox.innerHTML = '';
        const currentChat = allChats[activeChatId];
        if (currentChat && currentChat.length > 0) {
            currentChat.forEach(msg => addMessageToBox(msg.role, msg.parts[0].text, false));
        }
        renderDashboard();
    };

    const startNewChat = () => {
        const newChatId = Date.now().toString();
        allChats[newChatId] = []; // Bắt đầu với lịch sử rỗng
        addMessageToBox('model', "Chào bạn! Tôi là Gia sư AI. Hãy chọn một công cụ và bắt đầu nhé!", false); // Chỉ hiển thị
        allChats[newChatId].push({ role: 'model', parts: [{ text: "Chào bạn! Tôi là Gia sư AI. Hãy chọn một công cụ và bắt đầu nhé!" }] }); // Thêm vào state
        saveChatsToStorage();
        setActiveChat(newChatId);
    };

    // --- MAIN EVENT LISTENERS ---
    if (toggleDashboardBtn && dashboard) toggleDashboardBtn.addEventListener('click', () => dashboard.classList.toggle('collapsed'));
    if (newChatBtn) newChatBtn.addEventListener('click', startNewChat);
    if (historyList) historyList.addEventListener('click', (e) => {
        const item = e.target.closest('.history-item');
        if (item?.dataset.chatId) setActiveChat(item.dataset.chatId);
    });

    toolSelector.addEventListener('click', (e) => {
        const clickedButton = e.target.closest('.tool-btn');
        if (!clickedButton) return;
        document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
        clickedButton.classList.add('active');
        activeTool = clickedButton.dataset.tool;
        userInput.placeholder = {
            web_search: "Nhập nội dung tìm kiếm...",
            image_generation: "Mô tả hình ảnh bạn muốn tạo...",
            chat: "Đặt câu hỏi cho gia sư...",
        }[activeTool] || "Đặt câu hỏi...";
    });

    if (fileInput) fileInput.addEventListener('change', async (e) => { /* Logic file input */ });
    
    const handleSend = async () => {
        const userMessage = userInput.value.trim();
        if (!userMessage) return;

        // Bất khả chiến bại: Nếu không có active chat, tạo mới ngay lập tức
        if (!activeChatId || !allChats[activeChatId]) {
            console.warn("No active chat found. Creating a new one.");
            startNewChat();
        }

        const userMessageText = {
            web_search: `[Tìm kiếm]: ${userMessage}`,
            image_generation: `[Tạo ảnh]: ${userMessage}`,
            chat: userMessage,
        }[activeTool] || userMessage;

        addMessageToBox('user', userMessageText, true);
        userInput.value = '';
        showTypingIndicator();

        let endpoint;
        let payload;

        if (activeTool === 'image_generation') {
            endpoint = '/.netlify/functions/generateImage';
            payload = { prompt: userMessage };
        } else {
            endpoint = '/.netlify/functions/callGemini';
            payload = {
                history: allChats[activeChatId],
                action: { type: activeTool, message: userMessage },
                context: documentContext,
            };
        }

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Lỗi không xác định.');
            
            const responseText = activeTool === 'image_generation'
                ? `<img src="${data.imageUrl}" alt="${userMessage}" class="generated-image">`
                : data.response;
            addMessageToBox('model', responseText, true);
        } catch (error) {
            addMessageToBox('model', `Xin lỗi, có lỗi: ${error.message}`, true);
        }
    }

    chatForm.addEventListener('submit', (e) => { e.preventDefault(); handleSend(); });
    sendBtn.addEventListener('click', handleSend);

    // --- INITIALIZATION ---
    function initializeApp() {
        loadChatsFromStorage();
        const chatIds = Object.keys(allChats);
        if (chatIds.length > 0) {
            const latestChatId = chatIds.sort((a, b) => b - a)[0];
            setActiveChat(latestChatId);
        } else {
            startNewChat();
        }
    }

    initializeApp();
});
