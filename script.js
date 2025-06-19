document.addEventListener('DOMContentLoaded', () => {
    // === DOM ELEMENTS ===
    const chatBox = document.getElementById('chat-box');
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const micBtn = document.getElementById('mic-btn');
    const cameraBtn = document.getElementById('camera-btn');
    const webSearchBtn = document.getElementById('web-search-btn');
    const newChatBtn = document.getElementById('new-chat-btn');
    const toggleHistoryBtn = document.getElementById('toggle-history-btn');
    const historyPanel = document.getElementById('history-panel');
    const appContainer = document.getElementById('app-container');
    const loadingIndicator = document.getElementById('loading-indicator');
    const ttsToggle = document.getElementById('tts-toggle');

    // Media elements
    const mediaPreviewArea = document.getElementById('media-preview-area');
    const imagePreviewContainer = document.getElementById('image-preview-container');
    const imagePreview = document.getElementById('image-preview');
    const removeImageBtn = document.getElementById('remove-image-btn');
    const videoFeedContainer = document.getElementById('video-feed-container');
    const videoFeed = document.getElementById('video-feed');
    const captureBtn = document.getElementById('capture-btn');
    const cancelCameraBtn = document.getElementById('cancel-camera-btn');
    const canvas = document.getElementById('canvas');
    
    // === STATE ===
    let conversationHistory = [];
    let capturedImageBase64 = null;
    let isSearchMode = false;
    let mediaStream = null;

    // === SPEECH RECOGNITION (STT) ===
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition;
    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.lang = 'vi-VN';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            userInput.value = transcript;
            stopRecording();
            sendMessage(); // Automatically send after speech
        };
        
        recognition.onerror = (event) => {
            console.error('Lỗi nhận dạng giọng nói:', event.error);
            stopRecording();
        };

        recognition.onend = () => {
            stopRecording();
        };
    } else {
        micBtn.style.display = 'none';
        console.warn("Trình duyệt không hỗ trợ Web Speech API.");
    }
    
    const startRecording = () => {
        if (recognition) {
            micBtn.classList.add('recording');
            recognition.start();
        }
    };
    
    const stopRecording = () => {
        if (recognition) {
            micBtn.classList.remove('recording');
            recognition.stop();
        }
    };

    // === TEXT TO SPEECH (TTS) ===
    const speak = (text) => {
        if (!ttsToggle.checked) return;
        window.speechSynthesis.cancel(); // Dừng bất kỳ giọng nói nào đang phát
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'vi-VN';
        window.speechSynthesis.speak(utterance);
    };

    // === CAMERA FUNCTIONS ===
    const startCamera = async () => {
        try {
            if (mediaStream) {
                mediaStream.getTracks().forEach(track => track.stop());
            }
            mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
            videoFeed.srcObject = mediaStream;
            videoFeedContainer.classList.remove('hidden');
            mediaPreviewArea.classList.remove('hidden');
            imagePreviewContainer.classList.add('hidden');
        } catch (err) {
            console.error("Lỗi truy cập camera:", err);
            appendMessage("Không thể truy cập camera. Vui lòng cấp quyền.", 'bot');
        }
    };

    const stopCamera = () => {
        if (mediaStream) {
            mediaStream.getTracks().forEach(track => track.stop());
        }
        videoFeedContainer.classList.add('hidden');
        if (!capturedImageBase64) {
             mediaPreviewArea.classList.add('hidden');
        }
        mediaStream = null;
    };

    const captureImage = () => {
        const context = canvas.getContext('2d');
        canvas.width = videoFeed.videoWidth;
        canvas.height = videoFeed.videoHeight;
        context.drawImage(videoFeed, 0, 0, canvas.width, canvas.height);
        
        capturedImageBase64 = canvas.toDataURL('image/jpeg').split(',')[1];
        
        imagePreview.src = `data:image/jpeg;base64,${capturedImageBase64}`;
        imagePreviewContainer.classList.remove('hidden');
        
        stopCamera();
    };
    
    const removeImage = () => {
        capturedImageBase64 = null;
        imagePreview.src = '';
        imagePreviewContainer.classList.add('hidden');
        mediaPreviewArea.classList.add('hidden');
    };

    // === CORE CHAT FUNCTIONS ===
    const appendMessage = (message, sender, sources = []) => {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', sender);

        if (sender === 'bot') {
            // Sử dụng thư viện "marked" để render Markdown từ AI
            let htmlContent = marked.parse(message);
            if (sources.length > 0) {
                htmlContent += `<div class="sources"><strong>Nguồn:</strong> ${sources.join(', ')}</div>`;
            }
            messageElement.innerHTML = htmlContent;
        } else {
            messageElement.textContent = message;
        }
        
        chatBox.appendChild(messageElement);
        chatBox.scrollTop = chatBox.scrollHeight;
    };

    const sendMessage = async () => {
        const prompt = userInput.value.trim();
        if (!prompt && !capturedImageBase64) return;

        appendMessage(prompt, 'user');
        
        // Hiển thị loading
        loadingIndicator.classList.remove('hidden');
        userInput.value = '';
        userInput.style.height = 'auto'; // Reset height
        
        let endpoint = '/chat';
        let body;
        
        if (isSearchMode) {
            endpoint = '/search-and-summarize';
            body = { query: prompt };
            isSearchMode = false; // Reset sau khi gửi
            webSearchBtn.classList.remove('active'); // Ví dụ: đổi style
        } else {
            body = {
                history: conversationHistory,
                prompt: prompt,
                imageBase64: capturedImageBase64
            };
        }

        try {
            const response = await fetch(`http://localhost:3000${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                throw new Error(`Lỗi HTTP: ${response.status}`);
            }

            const data = await response.json();
            const botResponse = data.response;
            const sources = data.sources || [];

            appendMessage(botResponse, 'bot', sources);
            speak(botResponse.replace(/`/g, '').replace(/\*/g, '')); // Đọc câu trả lời, loại bỏ ký tự markdown

            // Cập nhật lịch sử
            if (!isSearchMode) {
                conversationHistory.push({ role: 'user', parts: [{text: prompt}] });
                conversationHistory.push({ role: 'model', parts: [{text: botResponse}] });
            }

        } catch (error) {
            console.error("Lỗi khi gửi tin nhắn:", error);
            appendMessage("Rất tiếc, đã có lỗi xảy ra. Vui lòng thử lại sau.", 'bot');
        } finally {
            // Dọn dẹp sau khi gửi
            removeImage();
            loadingIndicator.classList.add('hidden');
            userInput.focus();
        }
    };
    
    // === EVENT LISTENERS ===
    sendBtn.addEventListener('click', sendMessage);
    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    userInput.addEventListener('input', () => {
        userInput.style.height = 'auto';
        userInput.style.height = (userInput.scrollHeight) + 'px';
    });
    
    micBtn.addEventListener('click', () => {
        if (micBtn.classList.contains('recording')) {
            stopRecording();
        } else {
            startRecording();
        }
    });

    cameraBtn.addEventListener('click', startCamera);
    captureBtn.addEventListener('click', captureImage);
    cancelCameraBtn.addEventListener('click', stopCamera);
    removeImageBtn.addEventListener('click', removeImage);

    webSearchBtn.addEventListener('click', () => {
        isSearchMode = true;
        // Thêm hiệu ứng UI để người dùng biết đang ở chế độ tìm kiếm
        userInput.placeholder = "Nhập chủ đề bạn muốn tìm kiếm và tóm tắt...";
        userInput.focus();
        // Bạn có thể thêm class để đổi màu nút
        // webSearchBtn.classList.add('active'); 
    });

    newChatBtn.addEventListener('click', () => {
        chatBox.innerHTML = '<div class="message bot">Chào bạn! Tôi có thể giúp gì cho bạn hôm nay?</div>';
        conversationHistory = [];
        removeImage();
        isSearchMode = false;
        userInput.placeholder = "Nhập tin nhắn hoặc sử dụng mic...";
    });

    toggleHistoryBtn.addEventListener('click', () => {
        historyPanel.classList.toggle('collapsed');
        // Thêm logic để thay đổi icon nếu muốn
        const icon = toggleHistoryBtn.querySelector('i');
        if (historyPanel.classList.contains('collapsed')) {
            icon.classList.remove('fa-chevron-left');
            icon.classList.add('fa-chevron-right');
        } else {
            icon.classList.remove('fa-chevron-right');
            icon.classList.add('fa-chevron-left');
        }
    });
});
