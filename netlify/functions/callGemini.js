const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// Định nghĩa Tools
const tools = [{ functionDeclarations: [ /* ... */ ] }];
// Định nghĩa Function Executors
const functionExecutors = { /* ... */ };

const model = genAI.getGenerativeModel({
  model: 'gemini-1.5-flash-latest',
  tools: tools,
});

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405 };
    try {
        const { history, action, context } = JSON.parse(event.body);

        if (!action || !action.message) throw new Error("Yêu cầu không hợp lệ.");

        // --- LOGIC XỬ LÝ LỊCH SỬ DỨT KHOÁT ---
        // 1. Luôn bắt đầu với mảng lịch sử sạch
        let chatHistoryForModel = [];
        // 2. Chỉ xử lý history nếu nó tồn tại và là một mảng
        if (Array.isArray(history)) {
            // 3. Lọc ra các phần tử hợp lệ
            const validHistory = history.filter(h => h.role && h.parts && h.parts[0]?.text);
            // 4. Tìm vị trí tin nhắn user đầu tiên
            const firstUserIndex = validHistory.findIndex(h => h.role === 'user');
            // 5. Nếu tìm thấy, cắt mảng từ đó. Nếu không, history vẫn là mảng rỗng.
            if (firstUserIndex > -1) {
                chatHistoryForModel = validHistory.slice(firstUserIndex);
            }
        }

        const chat = model.startChat({ history: chatHistoryForModel });
        
        // Xây dựng prompt cuối cùng
        let finalPrompt = action.message;
        if (context) {
            finalPrompt = `Dựa vào ngữ cảnh sau đây: "${context}".\n\nHãy trả lời câu hỏi: "${action.message}"`;
        } else if (action.type === 'web_search') {
            finalPrompt = `Hãy tìm kiếm trên web và trả lời câu hỏi sau: "${action.message}"`;
        }

        const result = await chat.sendMessage(finalPrompt);
        let response = result.response;

        // Xử lý Function Calling
        const functionCalls = response.functionCalls();
        if (functionCalls && functionCalls.length > 0) {
            // ... (giữ nguyên logic xử lý function calling)
        }
        
        return { statusCode: 200, body: JSON.stringify({ response: response.text() }) };
    } catch (error) {
        console.error('LỖI TRONG HANDLER callGemini:', error);
        return { statusCode: 500, body: JSON.stringify({ error: `[Lỗi Gemini]: ${error.message}` }) };
    }
};

// Bạn copy lại định nghĩa tools và executors từ phiên bản trước
