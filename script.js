// script.js (Phiên bản hoàn chỉnh với các tính năng mới)

document.addEventListener('DOMContentLoaded', () => {

    // === DOM Elements ===
    // ... (Toàn bộ phần khai báo DOM giữ nguyên)
    const micBtn = document.getElementById('mic-btn');
    const toolButtonsContainer = document.getElementById('tool-buttons');

    // === State Variables ===
    // ... (Toàn bộ phần biến trạng thái giữ nguyên)
    let uploadedDocumentText = null; // Lưu trữ văn bản từ PDF/DOCX
    let recognition; // Cho Speech Recognition API
    const synth = window.speechSynthesis; // Cho Speech Synthesis API
    
    // === Initialization ===
    // ... (Toàn bộ phần khởi tạo giữ nguyên) ...
    initializeSpeechRecognition();


    // === Event Listeners ===
    // ... (Listeners cũ giữ nguyên)
    micBtn.addEventListener('click', toggleSpeechRecognition);
    toolButtonsContainer.addEventListener('click', handleToolButtonClick);


    // === New Feature Handlers ===

    function initializeSpeechRecognition() {
        window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (window.SpeechRecognition) {
            recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.lang = 'vi-VN';
            recognition.interimResults = true;

            recognition.onresult = (event) => {
                let interim_transcript = '';
                let final_transcript = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        final_transcript += event.results[i][0].transcript;
                    } else {
                        interim_transcript += event.results[i][0].transcript;
                    }
                }
                promptInput.value = promptInput.value.substring(0, promptInput.selectionStart) + final_transcript;
            };
            
            recognition.onstart = () => micBtn.classList.add('recording');
            recognition.onend = () => micBtn.classList.remove('recording');
            recognition.onerror = (event) => console.error('Speech recognition error:', event.error);
        } else {
            micBtn.style.display = 'none'; // Ẩn nút nếu trình duyệt không hỗ trợ
        }
    }

    function toggleSpeechRecognition() {
        if (micBtn.classList.contains('recording')) {
            recognition.stop();
        } else {
            if(synth.speaking) synth.cancel(); // Dừng phát âm thanh nếu có
            recognition.start();
        }
    }

    function textToSpeech(text, button) {
        if (synth.speaking) {
            synth.cancel(); // Dừng cái đang nói
            document.querySelectorAll('.tts-button.speaking').forEach(b => b.classList.remove('speaking'));
            if (button.dataset.speaking === 'true') {
                 button.dataset.speaking = 'false';
                 return;
            }
        }
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'vi-VN';
        utterance.onstart = () => {
            button.classList.add('speaking');
            button.dataset.speaking = 'true';
        };
        utterance.onend = () => {
            button.classList.remove('speaking');
            button.dataset.speaking = 'false';
        };
        synth.speak(utterance);
    }
    
    async function handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Reset trạng thái cũ
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
                        fullText += textContent.items.map(item => item.str).join(' ');
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
        // ... (Giữ nguyên logic cũ)
        // Thêm reset cho các trạng thái mới
        uploadedDocumentText = null;
        toolButtonsContainer.style.display = 'none';
        fileInput.value = '';
        // ...
    }
    
    async function handleToolButtonClick(event) {
        if (!event.target.classList.contains('tool-btn')) return;
        
        const task = event.target.dataset.task;
        if (!uploadedDocumentText) {
            alert("Vui lòng tải lên một file PDF hoặc DOCX trước.");
            return;
        }

        displayMessage(`Yêu cầu: ${event.target.textContent}`, 'user');
        saveMessageToSession('user', `Yêu cầu: ${event.target.textContent}`);
        showLoadingIndicator();

        try {
            const response = await fetch('/.netlify/functions/processDocument', {
                method: 'POST',
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


    // === Core Logic (Updated) ===
    
    // ... (Toàn bộ các hàm handleSendMessage, handleSearchRequest, quản lý session, UI helpers giữ nguyên logic cốt lõi) ...
    // Cần sửa đổi `displayMessage` để thêm nút TTS
    
    function displayMessage(text, sender, fileName = null) {
        // ... (logic tạo messageDiv, contentDiv giữ nguyên) ...
        // Thêm nút TTS cho AI
        if (sender === 'ai' && text) {
            // ... (code nút copy giữ nguyên)
            
            const ttsButton = document.createElement('button');
            ttsButton.classList.add('tts-button');
            ttsButton.innerHTML = '🔊';
            ttsButton.title = 'Đọc to';
            ttsButton.addEventListener('click', () => textToSpeech(text, ttsButton));
            
            // Chèn nút TTS vào sau nội dung
            const firstP = contentDiv.querySelector('p');
            if(firstP) {
                firstP.appendChild(ttsButton);
            } else {
                 contentDiv.appendChild(ttsButton);
            }
        }
        // ... (phần còn lại của hàm giữ nguyên) ...
    }

    function showLoadingIndicator(sender = 'ai', text = 'Gia Sư AI đang suy nghĩ...') {
        // ... (cập nhật để nhận text tùy chỉnh)
    }

    // `callGeminiAPI` vẫn được dùng cho chat và ảnh thông thường
    // ... (Hàm này giữ nguyên như phiên bản trước)

    // ... (Dán toàn bộ phần còn lại của script.js từ phiên bản trước vào đây: startNewChat, loadSession, saveMessageToSession, v.v...)
    // Đảm bảo không dán trùng lặp các hàm đã được sửa đổi ở trên.

});
