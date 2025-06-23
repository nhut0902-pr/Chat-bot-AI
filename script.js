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
    const fileInput = document.getElementById('file-input');

    if (!chatBox || !chatForm || !userInput || !toolSelector) {
        document.body.innerHTML = "<h1>Lỗi tải giao diện. Vui lòng kiểm tra lại file HTML.</h1>";
        return;
    }

    // State Management
    let allChats = {};
    let activeChatId = null;
    let activeTool = 'chat';
    let documentContext = ""; // Context từ file PDF

    // --- HELPER FUNCTIONS ---
    const showStatusMessage = (text) => {
        const statusElement = document.createElement('div');
        statusElement.classList.add('message', 'status-message');
        statusElement.textContent = text;
        chatBox.appendChild(statusElement);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    // --- DASHBOARD & HISTORY LOGIC ---
    const saveChatsToStorage = () => localStorage.setItem('allGiaSuAIChats', JSON.stringify(allChats));
    const loadChatsFromStorage = () => allChats = JSON.parse(localStorage.getItem('allGiaSuAIChats') || '{}');

    const renderDashboard = () => { /* Giữ nguyên logic */ };
    const setActiveChat = (chatId) => { /* Giữ nguyên logic */ };
    
    const startNewChat = () => {
        documentContext = ""; // Reset context khi bắt đầu chat mới
        const newChatId = Date.now().toString();
        allChats[newChatId] = [{ role: 'model', parts: [{ text: "Chào bạn! Tôi là Gia sư AI. Hãy chọn một công cụ và bắt đầu nhé!" }] }];
        saveChatsToStorage();
        setActiveChat(newChatId);
    };

    // --- UI & MESSAGE FUNCTIONS ---
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
    
    const showTypingIndicator = () => { /* Giữ nguyên logic */ };

    // --- MAIN EVENT LISTENERS ---
    toggleDashboardBtn.addEventListener('click', () => dashboard.classList.toggle('collapsed'));
    newChatBtn.addEventListener('click', startNewChat);
    historyList.addEventListener('click', (e) => {
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

    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        showStatusMessage(`Đang xử lý file: ${file.name}...`);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('/.netlify/functions/processFile', { method: 'POST', body: formData });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);
            documentContext = data.content; // Lưu context
            showStatusMessage(`Đã sẵn sàng hỏi về file: ${file.name}`);
        } catch (error) {
            showStatusMessage(`Lỗi xử lý file: ${error.message}`);
        }
        fileInput.value = ''; // Reset input
    });

    chatForm.addEventListener('submit', (e) => { e.preventDefault(); sendBtn.click(); });
    sendBtn.addEventListener('click', async () => {
        const userMessage = userInput.value.trim();
        if (!userMessage) return;

        if (!activeChatId) {
            alert("Lỗi! Vui lòng làm mới trang.");
            return;
        }

        let endpoint;
        let payload;
        const userMessageText = {
            web_search: `[Tìm kiếm]: ${userMessage}`,
            image_generation: `[Tạo ảnh]: ${userMessage}`,
            chat: userMessage,
        }[activeTool] || userMessage;

        addMessageToBox('user', userMessageText);
        userInput.value = '';
        showTypingIndicator();

        if (activeTool === 'image_generation') {
            endpoint = '/.netlify/functions/generateImage';
            payload = { prompt: userMessage };
        } else {
            endpoint = '/.netlify/functions/callGemini';
            payload = {
                history: allChats[activeChatId],
                action: { type: activeTool, message: userMessage },
                context: documentContext, // Gửi cả context từ file
            };
        }

        try {
            const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Lỗi không xác định.');
            
            const responseText = activeTool === 'image_generation'
                ? `<img src="${data.imageUrl}" alt="${userMessage}" class="generated-image">`
                : data.response;
            addMessageToBox('model', responseText);
        } catch (error) {
            addMessageToBox('model', `Xin lỗi, có lỗi: ${error.message}`);
        }
    });

    // --- INITIALIZATION ---
    function initializeApp() {
        loadChatsFromStorage();
        const chatIds = Object.keys(allChats);
        if (chatIds.length > 0) {
            setActiveChat(chatIds.sort((a, b) => b - a)[0]);
        } else {
            startNewChat();
        }
    }

    initializeApp();
});
// Các hàm bị thiếu như renderDashboard, setActiveChat,... bạn có thể copy từ phiên bản trước.
