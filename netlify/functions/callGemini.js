const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');
// ... (code định nghĩa tools và functionExecutors giữ nguyên)

const model = genAI.getGenerativeModel({
  model: 'gemini-1.5-flash-latest',
  tools: tools,
});

exports.handler = async (event) => {
    try {
        // Nhận cả history và payload từ frontend
        const { history, payload } = JSON.parse(event.body);
        const { type, message } = payload;

        const chat = model.startChat({ history: history || [] });
        let finalPrompt = message;

        // Xây dựng prompt dựa trên công cụ được chọn
        if (type === 'web_search') {
            finalPrompt = `Hãy tìm kiếm trên web và trả lời câu hỏi sau một cách chi tiết: "${message}"`;
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
        console.error('LỖI TRONG HANDLER:', error);
        return { statusCode: 500, body: JSON.stringify({ error: `Lỗi từ server: ${error.message}` }) };
    }
};
