document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const dashboard = document.getElementById('dashboard');
    const toggleDashboardBtn = document.getElementById('toggle-dashboard-btn');
    const historyList = document.getElementById('history-list');
    const newChatBtn = document.getElementById('new-chat-btn');
    const chatBox = document.getElementById('chat-box');
    const chatForm = document.getElementById('chat-form');
    const userInput = document.getElementById('user-input');
    const toolSelector = document.querySelector('.tool-selector');

    if (!chatBox || !chatForm || !userInput || !toolSelector) {
        console.error("Lỗi nghiêm trọng: Không tìm thấy các thành phần giao diện cốt lõi!");
        alert("Lỗi tải giao diện, vui lòng làm mới trang.");
        return;
    }

    // State Management
    let allChats = {};
    let activeChatId = null;
    let activeTool = 'chat'; 

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

    // --- DASHBOARD & HISTORY ---
    const renderDashboard = () => { /* Giữ nguyên hàm này */ };
    const saveChatsToStorage = () => localStorage.setItem('allGiaSuAIChats', JSON.stringify(allChats));
    const loadChatsFromStorage = () => { /* Giữ nguyên hàm này */ };
    const loadChat = (chatId) => { /* Giữ nguyên hàm này */ };
    const startNewChat = () => { /* Giữ nguyên hàm này */ };

    // --- UI & MESSAGE FUNCTIONS ---
    const addMessageToBox = (sender, text, isNew = true) => { /* Giữ nguyên hàm này */ };
    const showTypingIndicator = () => { /* Giữ nguyên hàm này */ };

    // --- MAIN EVENT LISTENER ---
    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const userMessage = userInput.value.trim();
        if (!userMessage) return;

        if (!activeChatId) {
            alert("Lỗi: Không có phiên chat nào đang hoạt động. Vui lòng làm mới trang.");
            return;
        }

        let endpoint;
        let payload;
        
        // --- ĐỒNG BỘ HÓA LOGIC ---
        // Thêm tin nhắn của user vào UI trước khi gửi
        let userMessageText = userMessage;
        if (activeTool === 'web_search') {
            userMessageText = `[Tìm kiếm]: ${userMessage}`;
        } else if (activeTool === 'image_generation') {
            userMessageText = `[Tạo ảnh]: ${userMessage}`;
        }
        addMessageToBox('user', userMessageText);
        
        switch (activeTool) {
            case 'image_generation':
                endpoint = '/.netlify/functions/generateImage';
                payload = { prompt: userMessage };
                break;
            default: // Bao gồm 'chat' và 'web_search'
                endpoint = '/.netlify/functions/callGemini';
                payload = {
                    history: allChats[activeChatId],
                    // Gửi một đối tượng 'action' rõ ràng
                    action: {
                        type: activeTool, // 'chat' hoặc 'web_search'
                        message: userMessage,
                    }
                };
                break;
        }

        userInput.value = '';
        showTypingIndicator();

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await response.json();
            if (!response.ok) {
                // Hiển thị lỗi từ server nếu có, nếu không thì báo lỗi chung
                throw new Error(data.error || 'Lỗi không xác định từ server.');
            }

            // Xử lý kết quả trả về
            if (activeTool === 'image_generation') {
                addMessageToBox('model', `<img src="${data.imageUrl}" alt="${userMessage}" class="generated-image">`);
            } else {
                addMessageToBox('model', data.response);
            }
        } catch (error) {
            console.error(`Lỗi khi thực hiện hành động '${activeTool}':`, error);
            addMessageToBox('model', `Xin lỗi, có lỗi: ${error.message}`);
        }
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

// Bạn có thể copy lại các hàm đã giữ nguyên từ phiên bản trước
// để file này đầy đủ.
