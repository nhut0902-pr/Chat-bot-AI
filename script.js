// script.js (Phiên bản hoàn chỉnh đã sửa lỗi khởi tạo)

document.addEventListener('DOMContentLoaded', () => {

    // === DOM Elements ===
    const mainContainer = document.getElementById('main-container');
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const toggleArrow = sidebarToggle.querySelector('.arrow');
    const chatBox = document.getElementById('chat-box');
    const promptInput = document.getElementById('prompt-input');
    const sendBtn = document.getElementById('send-btn');
    const fileInput = document.getElementById('file-input');
    const filePreview = document.getElementById('file-preview');
    const fileNameDisplay = document.getElementById('file-name');
    const removeFileBtn = document.getElementById('remove-file-btn');
    const newChatBtn = document.getElementById('new-chat-btn');
    const chatHistoryList = document.getElementById('chat-history-list');
    const themeToggle = document.getElementById('theme-toggle');
    const micBtn = document.getElementById('mic-btn');
    const toolButtonsContainer = document.getElementById('tool-buttons');

    // === State Variables ===
    let uploadedFile = null;
    let uploadedDocumentText = null;
    let sessions = {};
    let currentSessionId = null;
    let recognition;
    const synth = window.speechSynthesis;
    
    // === Initialization ===
    initializeApplication();

    function initializeApplication() {
        // Tải các cài đặt từ localStorage trước
        const isSidebarCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
        mainContainer.classList.toggle('sidebar-collapsed', isSidebarCollapsed);
        updateToggleArrow();
    
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.body.classList.toggle('dark-mode', savedTheme === 'dark');
        themeToggle.checked = savedTheme === 'dark';

        // Gán tất cả các sự kiện
        attachEventListeners();

        // Khởi tạo các API phức tạp (như Speech Recognition) SAU KHI đã gán sự kiện
        initializeSpeechRecognition();

        // Tải lịch sử và bắt đầu chat
        loadSessionsFromStorage();
        renderHistoryList();
        if (!Object.keys(sessions).length) {
            startNewChat();
        } else {
            const lastSessionId = Object.keys(sessions).sort().pop();
            loadSession(lastSessionId);
        }
    }

    function attachEventListeners() {
        sidebarToggle.addEventListener('click', toggleSidebar);
        themeToggle.addEventListener('change', toggleTheme);
        sendBtn.addEventListener('click', handleSendMessage);
        fileInput.addEventListener('change', handleFileUpload);
        removeFileBtn.addEventListener('click', removeUploadedFile);
        newChatBtn.addEventListener('click', startNewChat);
        micBtn.addEventListener('click', toggleSpeechRecognition);
        toolButtonsContainer.addEventListener('click', handleToolButtonClick);

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
    }


    // === New Feature Handlers ===

    function initializeSpeechRecognition() {
        window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (window.SpeechRecognition) {
            // SỬA LỖI TẠI ĐÂY: Bọc toàn bộ khối khởi tạo trong try...catch
            try {
                recognition = new SpeechRecognition();
                recognition.continuous = true;
                recognition.lang = 'vi-VN';
                recognition.interimResults = false; // Chỉ lấy kết quả cuối cùng cho ổn định

                recognition.onresult = (event) => {
                    const last = event.results.length - 1;
                    const command = event.results[last][0].transcript;
                    promptInput.value += command;
                };
                
                recognition.onstart = () => micBtn.classList.add('recording');
                recognition.onend = () => micBtn.classList.remove('recording');
                recognition.onerror = (event) => {
                    console.error('Speech recognition error:', event.error);
                    micBtn.classList.remove('recording');
                    if(event.error === 'not-allowed' || event.error === 'service-not-allowed') {
                        alert("Bạn cần cấp quyền truy cập microphone cho trang web.");
                    }
                };
            } catch (error) {
                console.error("Không thể khởi tạo Speech Recognition:", error);
                micBtn.style.display = 'none'; // Ẩn nút nếu khởi tạo thất bại
            }
        } else {
            micBtn.style.display = 'none'; // Ẩn nút nếu trình duyệt không hỗ trợ
        }
    }

    function toggleSpeechRecognition() {
        if (!recognition) return;
        if (micBtn.classList.contains('recording')) {
            recognition.stop();
        } else {
            if(synth.speaking) synth.cancel();
            recognition.start();
        }
    }

    function textToSpeech(text, button) {
        if (synth.speaking) {
            synth.cancel();
            document.querySelectorAll('.tts-button.speaking').forEach(b => {
                b.classList.remove('speaking');
                b.dataset.speaking = 'false';
            });
            if (button && button.dataset.speaking === 'true') {
                 return;
            }
        }
        if (!text) return;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'vi-VN';
        utterance.onstart = () => {
            if(button) {
                button.classList.add('speaking');
                button.dataset.speaking = 'true';
            }
        };
        utterance.onend = () => {
            if(button) {
                button.classList.remove('speaking');
                button.dataset.speaking = 'false';
            }
        };
        synth.speak(utterance);
    }
    
    async function handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        removeUploadedFile();
        showLoadingIndicator('ai', 'Đang xử lý file...');

        try {
            if (file.type.startsWith('image/')) {
                uploadedFile = { name: file.name, type: file.type, data: file };
                fileNameDisplay.textContent = `Ảnh: ${file.name}`;
            } else if (file.type === 'application/pdf') {
                uploadedDocumentText = await parsePdf(file);
                fileNameDisplay.textContent = `PDF: ${file.name}`;
                toolButtonsContainer.style.display = 'flex';
            } else if (file.name.endsWith('.docx')) {
                uploadedDocumentText = await parseDocx(file);
                fileNameDisplay.textContent = `DOCX: ${file.name}`;
                toolButtonsContainer.style.display = 'flex';
            } else {
                throw new Error("Định dạng file không được hỗ trợ.");
            }
            filePreview.style.display = 'flex';
            removeFileBtn.style.display = 'inline-block';
        } catch(error) {
            displayMessage(`Lỗi xử lý file: ${error.message}`, 'ai');
        } finally {
            hideLoadingIndicator();
        }
    }

    async function parsePdf(file) {
        const fileReader = new FileReader();
        return new Promise((resolve, reject) => {
            fileReader.onload = async (event) => {
                try {
                    const typedarray = new Uint8Array(event.target.result);
                    const pdf = await pdfjsLib.getDocument(typedarray).promise;
                    let fullText = '';
                    for (let i = 1; i <= pdf.numPages; i++) {
                        const page = await pdf.getPage(i);
                        const textContent = await page.getTextContent();
                        fullText += textContent.items.map(item => item.str).join(' ') + '\n';
                    }
                    resolve(fullText);
                } catch (error) {
                    reject(error);
                }
            };
            fileReader.readAsArrayBuffer(file);
        });
    }

    async function parseDocx(file) {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
        return result.value;
    }
    
    function removeUploadedFile() {
        uploadedFile = null;
        uploadedDocumentText = null;
        fileInput.value = '';
        filePreview.style.display = 'none';
        toolButtonsContainer.style.display = 'none';
    }
    
    async function handleToolButtonClick(event) {
        if (!event.target.classList.contains('tool-btn')) return;
        
        const task = event.target.dataset.task;
        if (!uploadedDocumentText) {
            alert("Vui lòng tải lên một file PDF hoặc DOCX trước.");
            return;
        }

        const taskText = event.target.textContent;
        displayMessage(`Yêu cầu: ${taskText}`, 'user');
        saveMessageToSession('user', `Yêu cầu: ${taskText}`);
        showLoadingIndicator();

        try {
            const response = await fetch('/.netlify/functions/processDocument', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: uploadedDocumentText,
                    task: task
                })
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error);
            }
            const data = await response.json();
            displayMessage(data.result, 'ai');
            saveMessageToSession('ai', data.result);
        } catch (error) {
            displayMessage(`Lỗi: ${error.message}`, 'ai');
        } finally {
            hideLoadingIndicator();
        }
    }

    // === Core Logic & UI Helpers ===

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
    
    function toggleTheme() {
        document.body.classList.toggle('dark-mode');
        const theme = document.body.classList.contains('dark-mode') ? 'dark' : 'light';
        localStorage.setItem('theme', theme);
    }
    
    async function handleSendMessage() {
        const prompt = promptInput.value.trim();
        if (!prompt) return;

        let userMessageText = prompt;
        let fileForAPI = null;
        let contextText = null;

        if (uploadedFile) { // Nếu là ảnh
            userMessageText = `${prompt} (Kèm theo ảnh: ${uploadedFile.name})`;
            fileForAPI = uploadedFile;
        } else if (uploadedDocumentText) { // Nếu là tài liệu
            userMessageText = `${prompt} (Dựa trên tài liệu: ${fileNameDisplay.textContent})`;
            contextText = uploadedDocumentText;
        }

        displayMessage(prompt, 'user', uploadedFile ? uploadedFile.name : null);
        saveMessageToSession('user', prompt, uploadedFile ? uploadedFile.name : null);

        const currentPrompt = promptInput.value;
        promptInput.value = '';
        promptInput.style.height = 'auto';

        showLoadingIndicator();

        try {
            const responseText = await callGeminiAPI(currentPrompt, fileForAPI, contextText);
            displayMessage(responseText, 'ai');
            saveMessageToSession('ai', responseText);
        } catch (error) {
            console.error("Lỗi khi gọi API:", error);
            displayMessage(`Rất tiếc, đã có lỗi xảy ra: ${error.message}`, 'ai');
        } finally {
            hideLoadingIndicator();
            updateSessionTitle(currentPrompt);
            renderHistoryList();
        }
    }

    async function callGeminiAPI(prompt, file, contextText) {
        let finalPrompt = prompt;
        if (contextText) {
            finalPrompt = `Dựa vào nội dung tài liệu sau đây: """${contextText}""". Hãy trả lời câu hỏi: "${prompt}"`;
        }

        let filePayload = null;
        if (file) {
            const base64Data = await fileToBase64(file.data);
            filePayload = { type: file.type, data: base64Data };
        }
    
        const response = await fetch('/.netlify/functions/callGemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: finalPrompt, file: filePayload })
        });
    
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Lỗi không xác định từ server.");
        
        if (!data.candidates || !data.candidates[0].content) {
            if (data.candidates && data.candidates[0].finishReason === 'SAFETY') {
                 return "Rất tiếc, phản hồi đã bị chặn vì lý do an toàn. Vui lòng thử một câu hỏi khác.";
            }
            return "Xin lỗi, tôi không thể tạo phản hồi cho yêu cầu này.";
        }
        return data.candidates[0].content.parts[0].text;
    }

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

            const ttsButton = document.createElement('button');
            ttsButton.classList.add('tts-button');
            ttsButton.innerHTML = '🔊';
            ttsButton.title = 'Đọc to';
            ttsButton.addEventListener('click', () => textToSpeech(text, ttsButton));
            messageDiv.appendChild(ttsButton);
        }
        
        chatBox.appendChild(messageDiv);
        chatBox.scrollTop = chatBox.scrollHeight;
    }
    
    // === Session and Storage Management (No changes needed) ===
    function startNewChat() {
        currentSessionId = `session_${Date.now()}`;
        sessions[currentSessionId] = {
            title: "Cuộc trò chuyện mới",
            messages: []
        };
        chatBox.innerHTML = '';
        removeUploadedFile();
        displayMessage("Xin chào! Tôi là Gia Sư AI. Tôi có thể giúp gì cho bạn hôm nay?", 'ai');
        saveMessageToSession('ai', "Xin chào! Tôi là Gia Sư AI. Tôi có thể giúp gì cho bạn hôm nay?");
        renderHistoryList();
        highlightActiveSession();
    }

    function loadSession(sessionId) {
        if (!sessions[sessionId]) {
            startNewChat();
            return;
        }
        currentSessionId = sessionId;
        const session = sessions[sessionId];
        chatBox.innerHTML = '';
        removeUploadedFile();
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
            if (title) {
                sessions[currentSessionId].title = title.substring(0, 30) + (title.length > 30 ? '...' : '');
                saveSessionsToStorage();
                renderHistoryList();
            }
        }
    }

    function renderHistoryList() {
        chatHistoryList.innerHTML = '';
        Object.keys(sessions).sort((a, b) => b.localeCompare(a)).forEach(sessionId => {
            const session = sessions[sessionId];
            const a = document.createElement('a');
            a.textContent = session.title;
            a.href = '#';
            a.dataset.sessionId = sessionId;
            a.addEventListener('click', (e) => {
                e.preventDefault();
                loadSession(sessionId);
            });
            const li = document.createElement('li');
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
            try {
                sessions = JSON.parse(savedSessions);
            } catch (e) {
                sessions = {};
            }
        } else {
            sessions = {};
        }
    }
    
    function showLoadingIndicator(sender = 'ai', text = 'Gia Sư AI đang suy nghĩ...') {
        hideLoadingIndicator(); // Ensure no duplicates
        const loadingDiv = document.createElement('div');
        loadingDiv.id = 'loading-indicator';
        loadingDiv.classList.add('message', `${sender}-message`);
        loadingDiv.innerHTML = `<div class="message-content"><p>${text}</p></div>`;
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
