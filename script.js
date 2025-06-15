document.addEventListener('DOMContentLoaded', () => {
    // --- THAY THẾ API KEY CỦA BẠN VÀO ĐÂY ---
    const API_KEY = "AIzaSyAfDHxennpODubkvsAzkfEkP1vq9zBUXeM";
    // ------------------------------------------

    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:streamGenerateContent?key=${API_KEY}&alt=sse`;
    const TITLE_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;
    
    // --- DOM Elements ---
    const chatHistoryList = document.getElementById('chat-history-list');
    const newChatBtn = document.getElementById('new-chat-btn');
    const chatBox = document.getElementById('chat-box');
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const stopBtn = document.getElementById('stop-btn');
    const uploadBtn = document.getElementById('upload-btn');
    const imageUploadInput = document.getElementById('image-upload');
    const imagePreviewContainer = document.getElementById('image-preview-container');
    const imagePreview = document.getElementById('image-preview');
    const removeImageBtn = document.getElementById('remove-image-btn');
    const searchToggle = document.getElementById('search-toggle-checkbox');
    const userProfile = document.getElementById('user-profile');
    const userNameEl = document.getElementById('user-name');
    const themeToggle = document.getElementById('theme-toggle');

    // --- State Management ---
    let chats = [];
    let activeChatId = null;
    let uploadedImage = null; 
    let abortController = null;

    // ===================================================================
    // INITIALIZATION & STATE
    // ===================================================================

    function initializeApp() {
        loadTheme();
        loadUserData();
        loadChatsFromStorage();
        
        if (chats.length === 0) {
            createNewChat();
        } else {
            const lastActiveId = localStorage.getItem('gemini-activeChatId');
            const chatExists = chats.some(c => c.id === lastActiveId);
            setActiveChat(chatExists ? lastActiveId : chats[0].id);
        }
        renderSidebar();
        addEventListeners();
    }

    // ===================================================================
    // LONG-TERM MEMORY & FUNCTION CALLING (IMPROVED)
    // ===================================================================

    function getLongTermMemory() {
        return localStorage.getItem('gemini-long-term-memory') || "Chưa có thông tin nào được lưu.";
    }

    function updateLongTermMemory(newMemory) {
        const currentMemory = getLongTermMemory();
        const updatedMemory = currentMemory === "Chưa có thông tin nào được lưu." 
            ? newMemory 
            : `${currentMemory}\n- ${newMemory}`;
        localStorage.setItem('gemini-long-term-memory', updatedMemory);
        console.log("Bộ nhớ dài hạn đã được cập nhật:", updatedMemory);
    }

    function checkForLtmUpdate(text) {
        const ltmRegex = /\[LTM_UPDATE\]([\s\S]+?)\[\/LTM_UPDATE\]/;
        const match = text.match(ltmRegex);
        if (match && match[1]) {
            updateLongTermMemory(match[1].trim());
            return text.replace(ltmRegex, "").trim();
        }
        return text;
    }

    function getSystemInstruction() {
        return {
            parts: [{ text: `Bạn là một trợ lý AI đa năng.
1.  **Bộ nhớ dài hạn:** Dưới đây là những sự thật bạn cần ghi nhớ về người dùng: "${getLongTermMemory()}". Nếu người dùng yêu cầu ghi nhớ, hãy cập nhật bộ nhớ bằng tag [LTM_UPDATE]Nội dung mới[/LTM_UPDATE].
2.  **Sử dụng công cụ:** Hãy chủ động và ưu tiên sử dụng các công cụ được cung cấp (như tìm kiếm web) khi cần thiết để có câu trả lời chính xác nhất. Đừng trả lời rằng bạn không biết nếu bạn có thể dùng công cụ để tìm ra.` }]
        }
    }

    const aichatTools = [
        {
            "functionDeclarations": [
                {
                    "name": "perform_web_search",
                    "description": "Bắt buộc sử dụng công cụ này để tìm kiếm thông tin thời gian thực hoặc các sự kiện mới. Rất hữu ích cho các câu hỏi về: thời tiết, tin tức, giá cổ phiếu, kết quả thể thao, thông tin về người nổi tiếng, hoặc bất kỳ chủ đề nào mà dữ liệu huấn luyện có thể đã lỗi thời.",
                    "parameters": {
                        "type": "OBJECT",
                        "properties": { "query": { "type": "STRING", "description": "Từ khóa tìm kiếm chính xác và chi tiết để nhập vào Google. Ví dụ: 'thời tiết Ninh Thuận hôm nay', 'giá cổ phiếu VNM'." } },
                        "required": ["query"]
                    }
                }
            ]
        }
    ];

    // ===================================================================
    // API COMMUNICATION
    // ===================================================================

    async function handleSendMessage() {
        const userText = userInput.value.trim();
        if (userText === '' && !uploadedImage) return;
        
        abortController = new AbortController();
        const activeChat = chats.find(c => c.id === activeChatId);
        if (!activeChat) return;

        if (activeChat.history.length === 0) chatBox.innerHTML = '';

        const userParts = [];
        if (userText) userParts.push({ text: userText });
        if (uploadedImage) {
            userParts.push({ inline_data: { mime_type: uploadedImage.mimeType, data: uploadedImage.base64 } });
        }

        displayMessage(userParts, 'user');
        activeChat.history.push({ role: 'user', parts: userParts });
        
        removeUploadedImage();
        userInput.value = '';
        userInput.style.height = 'auto';
        setLoading(true);
        
        const requestBody = {
            contents: activeChat.history,
            systemInstruction: getSystemInstruction(),
            tools: searchToggle.checked ? aichatTools : undefined,
        };
        
        await processApiTurn(requestBody);
    }
    
    async function processApiTurn(requestBody) {
        const aiMessageDiv = displayMessage([{text: ""}], 'ai');
        let fullResponse = "";
        let functionCalls = [];

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: abortController.signal,
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                 const errorText = await response.text();
                 throw new Error(`Lỗi API: ${response.status} - ${errorText}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');
                
                const parsedLines = lines
                    .map(line => line.replace(/^data: /, '').trim())
                    .filter(line => line !== '' && line !== '[DONE]')
                    .map(line => {
                        try { return JSON.parse(line); } 
                        catch (error) { console.warn("Bỏ qua dòng không hợp lệ từ stream:", line); return null; }
                    })
                    .filter(parsed => parsed !== null);

                for (const parsedLine of parsedLines) {
                    const candidate = parsedLine.candidates?.[0];
                    if (!candidate || !candidate.content) continue;

                    const part = candidate.content.parts[0];
                    if (part.text) {
                        fullResponse += part.text;
                        aiMessageDiv.innerHTML = marked.parse(fullResponse + " ▌");
                    }
                    if (part.functionCall) {
                        functionCalls.push(part.functionCall);
                    }
                }
            }

            if (functionCalls.length > 0) {
                 const activeChat = chats.find(c => c.id === activeChatId);
                 activeChat.history.push({ role: 'model', parts: functionCalls.map(fc => ({ functionCall: fc })) });

                 const funcName = functionCalls[0].name;
                 const funcArgs = functionCalls[0].args;
                 let funcResponseText = "";
                 
                 if (funcName === 'perform_web_search') {
                     window.open(`https://www.google.com/search?q=${encodeURIComponent(funcArgs.query)}`, '_blank');
                     funcResponseText = `Đã thực hiện tìm kiếm trên web cho: "${funcArgs.query}". Người dùng sẽ xem kết quả. Dựa vào đó, hãy tóm tắt và trả lời câu hỏi của họ.`;
                 }
                 
                 activeChat.history.push({
                     role: "tool",
                     parts: [{ functionResponse: { name: funcName, response: { content: funcResponseText } } }]
                 });
                 
                 const newRequestBody = { 
                     contents: activeChat.history,
                     systemInstruction: getSystemInstruction(),
                     tools: aichatTools 
                 };
                 await processApiTurn(newRequestBody);

            } else {
                fullResponse = checkForLtmUpdate(fullResponse);
                aiMessageDiv.innerHTML = marked.parse(fullResponse);
                highlightAndCopyCode(aiMessageDiv.parentElement);
                
                const activeChat = chats.find(c => c.id === activeChatId);
                activeChat.history.push({ role: 'model', parts: [{ text: fullResponse }] });
                autoRenameChat(activeChatId);
                setLoading(false);
            }
        
        } catch (error) {
            if (error.name === 'AbortError') {
                fullResponse += "\n\n*(Quá trình tạo đã bị dừng.)*";
                aiMessageDiv.innerHTML = marked.parse(fullResponse);
                 const activeChat = chats.find(c => c.id === activeChatId);
                activeChat.history.push({ role: 'model', parts: [{ text: fullResponse }] });
            } else {
                aiMessageDiv.innerHTML = `<p style="color: red;">${error.message}</p>`;
                console.error("API error:", error);
            }
            setLoading(false);
        } finally {
            saveChatsToStorage();
        }
    }

    // ===================================================================
    // CÁC HÀM TIỆN ÍCH VÀ SỰ KIỆN (Không thay đổi)
    // ===================================================================
    function loadChatsFromStorage() { const storedChats = localStorage.getItem('gemini-chats'); if (storedChats) { chats = JSON.parse(storedChats); } }
    function saveChatsToStorage() { localStorage.setItem('gemini-chats', JSON.stringify(chats)); localStorage.setItem('gemini-activeChatId', activeChatId); }
    function loadUserData() { let userName = localStorage.getItem('gemini-userName') || "Người dùng"; userNameEl.textContent = userName; }
    function createNewChat() { const newChat = { id: self.crypto.randomUUID(), title: 'Cuộc trò chuyện mới', history: [], createdAt: new Date().toISOString() }; chats.unshift(newChat); setActiveChat(newChat.id); saveChatsToStorage(); }
    function setActiveChat(chatId) { activeChatId = chatId; renderChatBox(); renderSidebar(); }
    function renderSidebar() { chatHistoryList.innerHTML = ''; chats.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); chats.forEach(chat => { const li = document.createElement('li'); li.textContent = chat.title; li.dataset.chatId = chat.id; if (chat.id === activeChatId) li.classList.add('active'); chatHistoryList.appendChild(li); }); }
    function renderChatBox() { chatBox.innerHTML = ''; const activeChat = chats.find(c => c.id === activeChatId); if (!activeChat || activeChat.history.length === 0) { displayWelcomeMessage(); return; } activeChat.history.forEach(message => { displayMessage(message.parts, message.role); }); }
    function displayWelcomeMessage() { chatBox.innerHTML = `<div class="message ai-message"><img src="https://i.imgur.com/g2109Tf.png" alt="AI Avatar" class="avatar"><div class="message-content"><p>Xin chào! Tôi là Gemini. Bắt đầu một cuộc trò chuyện mới hoặc chọn một cuộc trò chuyện cũ từ thanh bên.</p></div></div>`; }
    function displayMessage(parts, role) { const messageDiv = document.createElement('div'); const sender = (role === 'user' || role === 'tool') ? 'user' : 'ai'; messageDiv.className = `message ${sender}-message`; if (role === 'tool') messageDiv.style.display = 'none'; const avatarSrc = sender === 'ai' ? 'https://i.imgur.com/g2109Tf.png' : 'https://i.imgur.com/user-placeholder.png'; const contentDiv = document.createElement('div'); contentDiv.className = 'message-content'; const textPart = parts.find(p => p.text); if (textPart) { contentDiv.innerHTML = sender === 'ai' ? marked.parse(textPart.text) : `<p>${textPart.text}</p>`; } const imagePart = parts.find(p => p.inline_data); if (imagePart) { const img = document.createElement('img'); img.src = `data:${imagePart.inline_data.mime_type};base64,${imagePart.inline_data.data}`; img.className = 'sent-image'; contentDiv.appendChild(img); } const avatarImg = document.createElement('img'); avatarImg.src = avatarSrc; avatarImg.alt = `${sender} avatar`; avatarImg.className = 'avatar'; messageDiv.appendChild(avatarImg); messageDiv.appendChild(contentDiv); chatBox.appendChild(messageDiv); if (sender === 'ai') { highlightAndCopyCode(messageDiv); } chatBox.scrollTop = chatBox.scrollHeight; return contentDiv; }
    async function autoRenameChat(chatId) { const chat = chats.find(c => c.id === chatId); if (!chat || chat.title !== 'Cuộc trò chuyện mới' || chat.history.length < 2) return; const userPrompt = chat.history.find(h => h.role === 'user')?.parts.find(p => p.text)?.text || ''; const aiResponse = chat.history.find(h => h.role === 'model')?.parts.find(p => p.text)?.text.substring(0, 200) || ''; if (!userPrompt) return; const promptForTitle = `Tóm tắt cuộc trò chuyện sau thành một tiêu đề ngắn gọn không quá 5 từ. Chỉ trả về tiêu đề, không thêm bất kỳ lời giải thích nào.\n---\nNgười dùng: "${userPrompt}"\nAI: "${aiResponse}..."`; try { const response = await fetch(TITLE_API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: promptForTitle }] }] }) }); if (!response.ok) return; const data = await response.json(); const newTitle = data.candidates[0].content.parts[0].text.trim().replace(/["*]/g, ''); chat.title = newTitle; renderSidebar(); saveChatsToStorage(); } catch (error) { console.error("Could not auto-rename chat:", error); } }
    function highlightAndCopyCode(container) { container.querySelectorAll('pre').forEach(pre => { if (pre.querySelector('.copy-btn')) return; const copyButton = document.createElement('button'); copyButton.className = 'copy-btn'; copyButton.textContent = 'Chép'; pre.appendChild(copyButton); const codeElement = pre.querySelector('code'); if (codeElement) hljs.highlightElement(codeElement); }); }
    function handleImageUpload(event) { const file = event.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onloadend = () => { const base64String = reader.result.replace(/^data:.+;base64,/, ''); uploadedImage = { base64: base64String, mimeType: file.type }; imagePreview.src = reader.result; imagePreviewContainer.style.display = 'block'; }; reader.readAsDataURL(file); }
    function removeUploadedImage() { uploadedImage = null; imageUploadInput.value = ''; imagePreviewContainer.style.display = 'none'; }
    function setLoading(isLoading) { sendBtn.style.display = isLoading ? 'none' : 'block'; stopBtn.style.display = isLoading ? 'flex' : 'none'; userInput.disabled = isLoading; uploadBtn.disabled = isLoading; userInput.placeholder = isLoading ? "AI đang soạn câu trả lời..." : "Hỏi bất cứ điều gì..."; }
    function loadTheme() { const savedTheme = localStorage.getItem('theme'); if (savedTheme === 'dark') { document.body.classList.add('dark-mode'); themeToggle.checked = true; } }
    function addEventListeners() { sendBtn.addEventListener('click', handleSendMessage); userInput.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }); stopBtn.addEventListener('click', () => { if (abortController) { abortController.abort(); abortController = null; } }); uploadBtn.addEventListener('click', () => imageUploadInput.click()); imageUploadInput.addEventListener('change', handleImageUpload); removeImageBtn.addEventListener('click', removeUploadedImage); newChatBtn.addEventListener('click', createNewChat); chatHistoryList.addEventListener('click', e => { if (e.target && e.target.tagName === 'LI') { setActiveChat(e.target.dataset.chatId); } }); userProfile.addEventListener('click', () => { const currentName = localStorage.getItem('gemini-userName') || "Người dùng"; const newName = prompt("Thay đổi tên của bạn:", currentName); if (newName && newName.trim() !== "") { localStorage.setItem('gemini-userName', newName.trim()); userNameEl.textContent = newName.trim(); } }); themeToggle.addEventListener('change', () => { document.body.classList.toggle('dark-mode'); localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light'); }); }

    initializeApp();
});