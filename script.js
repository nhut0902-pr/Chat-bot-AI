// script.js

document.addEventListener('DOMContentLoaded', () => {

    // Các đối tượng DOM
    const mainContainer = document.getElementById('main-container');
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const toggleArrow = sidebarToggle.querySelector('.arrow');
    const chatBox = document.getElementById('chat-box');
    const promptInput = document.getElementById('prompt-input');
    const sendBtn = document.getElementById('send-btn');
    const searchBtn = document.getElementById('search-btn');
    const fileInput = document.getElementById('file-input');
    const filePreview = document.getElementById('file-preview');
    const fileNameDisplay = document.getElementById('file-name');
    const removeFileBtn = document.getElementById('remove-file-btn');
    const newChatBtn = document.getElementById('new-chat-btn');
    const chatHistoryList = document.getElementById('chat-history-list');
    const themeToggle = document.getElementById('theme-toggle');

    // Biến trạng thái
    let uploadedFile = null;
    let sessions = {};
    let currentSessionId = null;

    // --- KHỞI TẠO ỨNG DỤNG ---

    // 1. Tải trạng thái sidebar
    const isSidebarCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    mainContainer.classList.toggle('sidebar-collapsed', isSidebarCollapsed);
    updateToggleArrow();
    
    // 2. Tải chế độ sáng/tối
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.body.classList.toggle('dark-mode', savedTheme === 'dark');
    themeToggle.checked = savedTheme === 'dark';

    // 3. Tải lịch sử chat
    loadSessionsFromStorage();
    renderHistoryList();
    startNewChat();


    // --- XỬ LÝ SỰ KIỆN ---

    sidebarToggle.addEventListener('click', toggleSidebar);
    sendBtn.addEventListener('click', handleSendMessage);
    searchBtn.addEventListener('click', handleSearchRequest);
    fileInput.addEventListener('change', handleFileUpload);
    removeFileBtn.addEventListener('click', removeUploadedFile);
    newChatBtn.addEventListener('click', startNewChat);
    themeToggle.addEventListener('change', toggleTheme);

    promptInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    });
    promptInput.addEventListener('input', () => {
        promptInput.style.height = 'auto';
        promptInput.style.height = (promptInput.scrollHeight) + 'px';
    });


    // --- CÁC HÀM XỬ LÝ GIAO DIỆN MỚI ---
    
    function toggleSidebar() {
        const isCollapsed = mainContainer.classList.toggle('sidebar-collapsed');
        localStorage.setItem('sidebarCollapsed', isCollapsed);
        updateToggleArrow();
    }
    
    function updateToggleArrow() {
        if (mainContainer.classList.contains('sidebar-collapsed')) {
            toggleArrow.textContent = '>';
            sidebarToggle.title = "Hiện Lịch sử";
        } else {
            toggleArrow.textContent = '<';
            sidebarToggle.title = "Ẩn Lịch sử";
        }
    }

    // --- CÁC HÀM XỬ LÝ CHÍNH ---

    async function handleSendMessage() {
        const prompt = promptInput.value.trim();
        if (!prompt && !uploadedFile) return;

        displayMessage(prompt, 'user', uploadedFile ? uploadedFile.name : null);
        saveMessageToSession('user', prompt, uploadedFile ? uploadedFile.name : null);

        const currentPrompt = promptInput.value;
        const currentFile = uploadedFile;
        promptInput.value = '';
        promptInput.style.height = 'auto';
        removeUploadedFile();
        
        showLoadingIndicator();

        try {
            const responseText = await callGeminiAPI(currentPrompt, currentFile);
            displayMessage(responseText, 'ai');
            saveMessageToSession('ai', responseText);
        } catch (error) {
            console.error("Lỗi khi gọi API:", error);
            const errorMessage = `Rất tiếc, đã có lỗi xảy ra: ${error.message}`;
            displayMessage(errorMessage, 'ai');
            saveMessageToSession('ai', errorMessage);
        } finally {
            hideLoadingIndicator();
            updateSessionTitle(currentPrompt);
            renderHistoryList();
        }
    }

    async function handleSearchRequest() {
        const query = promptInput.value.trim();
        if (!query) {
            alert("Vui lòng nhập chủ đề cần tìm kiếm.");
            return;
        }

        displayMessage(query, 'user', '🌐 Tìm kiếm Web');
        saveMessageToSession('user', query, '🌐 Tìm kiếm Web');
        
        const searchPrompt = `Bạn là một trợ lý nghiên cứu AI. Dựa trên kiến thức của bạn, hãy thực hiện một tìm kiếm mô phỏng trên web về chủ đề sau: "${query}". 
    
        Hãy trả về kết quả theo định dạng sau:
        1.  **Tóm tắt thông tin:** Viết một đoạn văn bản tóm tắt các điểm chính về chủ đề này, như thể bạn đã đọc qua nhiều nguồn.
        2.  **Các nguồn tham khảo (giả định):** Liệt kê 3-5 URL trông có vẻ hợp lý mà bạn có thể đã sử dụng để thu thập thông tin này. Định dạng là: - [Tiêu đề bài viết] (URL)`;

        promptInput.value = '';
        promptInput.style.height = 'auto';
        removeUploadedFile();

        showLoadingIndicator();
        try {
            const responseText = await callGeminiAPI(searchPrompt, null);
            displayMessage(responseText, 'ai');
            saveMessageToSession('ai', responseText);
        } catch (error) {
            console.error("Lỗi khi tìm kiếm:", error);
            const errorMessage = `Lỗi trong quá trình tìm kiếm: ${error.message}`;
            displayMessage(errorMessage, 'ai');
            saveMessageToSession('ai', errorMessage);
        } finally {
            hideLoadingIndicator();
            updateSessionTitle(query);
            renderHistoryList();
        }
    }

    async function callGeminiAPI(prompt, file) {
        let filePayload = null;
        if (file) {
            // Chuyển file sang base64 ngay tại đây để gửi đi
            const base64Data = await fileToBase64(file.data);
            filePayload = {
                type: file.type,
                data: base64Data
            };
        }
    
        // Gọi đến Netlify Function của chính chúng ta
        const response = await fetch('/.netlify/functions/callGemini', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ prompt, file: filePayload }) // Gửi prompt và file payload
        });
    
        const data = await response.json();
    
        if (!response.ok) {
            // Nếu có lỗi từ function, hiển thị nó
            throw new Error(data.error || "Lỗi không xác định từ server.");
        }
        
        // Xử lý response từ Google mà function đã trả về
        if (!data.candidates || !data.candidates[0].content.parts) {
            // Kiểm tra trường hợp Google chặn nội dung
            if (data.candidates && data.candidates[0].finishReason === 'SAFETY') {
                 return "Rất tiếc, phản hồi đã bị chặn vì lý do an toàn. Vui lòng thử một câu hỏi khác.";
            }
            return "Xin lỗi, tôi không thể tạo phản hồi cho yêu cầu này.";
        }
        return data.candidates[0].content.parts[0].text;
    }

    // --- QUẢN LÝ LỊCH SỬ & SESSION ---

    function startNewChat() {
        currentSessionId = `session_${Date.now()}`;
        sessions[currentSessionId] = {
            title: "Cuộc trò chuyện mới",
            messages: []
        };
        chatBox.innerHTML = '';
        displayMessage("Xin chào! Tôi là Gia Sư AI. Tôi có thể giúp gì cho bạn hôm nay?", 'ai');
        saveMessageToSession('ai', "Xin chào! Tôi là Gia Sư AI. Tôi có thể giúp gì cho bạn hôm nay?");
        renderHistoryList();
        highlightActiveSession();
    }

    function loadSession(sessionId) {
        currentSessionId = sessionId;
        const session = sessions[sessionId];
        chatBox.innerHTML = '';
        session.messages.forEach(msg => {
            displayMessage(msg.text, msg.sender, msg.fileName);
        });
        highlightActiveSession();
    }

    function saveMessageToSession(sender, text, fileName = null) {
        if (!currentSessionId || !sessions[currentSessionId]) return;
        sessions[currentSessionId].messages.push({ sender, text, fileName });
        saveSessionsToStorage();
    }

    function updateSessionTitle(prompt) {
        if (sessions[currentSessionId] && sessions[currentSessionId].title === "Cuộc trò chuyện mới") {
            const title = prompt.trim();
            if (title) { // Chỉ cập nhật nếu prompt không rỗng
                sessions[currentSessionId].title = title.substring(0, 30) + (title.length > 30 ? '...' : '');
                saveSessionsToStorage();
            }
        }
    }

    function renderHistoryList() {
        chatHistoryList.innerHTML = '';
        Object.keys(sessions).sort((a, b) => b.localeCompare(a)).forEach(sessionId => {
            const session = sessions[sessionId];
            const li = document.createElement('li');
            const a = document.createElement('a');
            a.textContent = session.title;
            a.href = '#';
            a.dataset.sessionId = sessionId;
            a.addEventListener('click', (e) => {
                e.preventDefault();
                loadSession(sessionId);
            });
            li.appendChild(a);
            chatHistoryList.appendChild(li);
        });
        highlightActiveSession();
    }
    
    function highlightActiveSession() {
        document.querySelectorAll('#chat-history-list a').forEach(a => {
            a.classList.toggle('active', a.dataset.sessionId === currentSessionId);
        });
    }

    function saveSessionsToStorage() {
        localStorage.setItem('chatSessions', JSON.stringify(sessions));
    }

    function loadSessionsFromStorage() {
        const savedSessions = localStorage.getItem('chatSessions');
        if (savedSessions) {
            sessions = JSON.parse(savedSessions);
        } else {
            sessions = {};
        }
    }
    
    // --- CÁC HÀM TIỆN ÍCH ---

    function displayMessage(text, sender, fileName = null) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', `${sender}-message`);
        
        const contentDiv = document.createElement('div');
        contentDiv.classList.add('message-content');

        let contentHTML = '';
        if (fileName) {
            contentHTML += `<p><em><strong>${fileName}</strong></em></p>`;
        }
        if (text) {
            contentHTML += marked.parse(text);
        }
        contentDiv.innerHTML = contentHTML;
        messageDiv.appendChild(contentDiv);

        if (sender === 'ai' && text) {
            const copyButton = document.createElement('button');
            copyButton.classList.add('copy-btn');
            copyButton.innerHTML = '📋';
            copyButton.title = 'Sao chép nội dung';
            copyButton.addEventListener('click', () => {
                navigator.clipboard.writeText(text).then(() => {
                    const feedback = document.createElement('span');
                    feedback.textContent = 'Đã sao chép!';
                    feedback.classList.add('copy-feedback');
                    copyButton.appendChild(feedback);
                    setTimeout(() => feedback.remove(), 1500);
                });
            });
            messageDiv.appendChild(copyButton);
        }
        
        chatBox.appendChild(messageDiv);
        chatBox.scrollTop = chatBox.scrollHeight;
    }
    
    function toggleTheme() {
        document.body.classList.toggle('dark-mode');
        const theme = document.body.classList.contains('dark-mode') ? 'dark' : 'light';
        localStorage.setItem('theme', theme);
    }
    
    function handleFileUpload(event) {
        const file = event.target.files[0];
        if (file && file.type.startsWith('image/')) {
            uploadedFile = { name: file.name, type: file.type, data: file };
            fileNameDisplay.textContent = `File: ${file.name}`;
            filePreview.style.display = 'flex';
            removeFileBtn.style.display = 'inline-block';
        } else {
            alert("Vui lòng chỉ tải lên file ảnh.");
            fileInput.value = '';
        }
    }

    function removeUploadedFile() {
        uploadedFile = null;
        fileInput.value = '';
        filePreview.style.display = 'none';
        fileNameDisplay.textContent = '';
        removeFileBtn.style.display = 'none';
    }

    function showLoadingIndicator() {
        const loadingDiv = document.createElement('div');
        loadingDiv.id = 'loading-indicator';
        loadingDiv.classList.add('message', 'ai-message');
        loadingDiv.innerHTML = `<div class="message-content"><p>Gia Sư AI đang suy nghĩ...</p></div>`;
        chatBox.appendChild(loadingDiv);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    function hideLoadingIndicator() {
        const indicator = document.getElementById('loading-indicator');
        if (indicator) indicator.remove();
    }

    function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.onerror = error => reject(error);
        });
    }
});
