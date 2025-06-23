const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

const tools = [{
  functionDeclarations: [{
    name: 'web_search',
    description: 'Tìm kiếm trên internet để lấy thông tin mới nhất.',
    parameters: {
      type: 'OBJECT',
      properties: { query: { type: 'STRING' } },
      required: ['query'],
    },
  }],
}];

const functionExecutors = { /* Giữ nguyên hàm này */ };

const model = genAI.getGenerativeModel({
  model: 'gemini-1.5-flash-latest',
  tools: tools,
});

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }
    try {
        // --- ĐỒNG BỘ HÓA LOGIC ---
        // Nhận một cấu trúc dữ liệu nhất quán từ frontend
        const { history, action } = JSON.parse(event.body);

        if (!action || !action.message) {
            throw new Error("Dữ liệu gửi lên không hợp lệ.");
        }

        const chat = model.startChat({ history: history || [] });
        
        let finalPrompt = action.message;
        // Xây dựng prompt đặc biệt cho tìm kiếm web
        if (action.type === 'web_search') {
            finalPrompt = `Hãy tìm kiếm trên web và trả lời câu hỏi sau: "${action.message}"`;
        }

        const result = await chat.sendMessage(finalPrompt);
        let response = result.response;

        // Xử lý Function Calling
        const functionCalls = response.functionCalls();
        if (functionCalls && functionCalls.length > 0) {
            const call = functionCalls[0];
            const executor = functionExecutors[call.name];
            if (executor) {
                const apiResponse = await executor(call.args);
                const result2 = await chat.sendMessage([{
                    functionResponse: { name: call.name, response: apiResponse },
                }]);
                response = result2.response;
            }
        }
        
        return { statusCode: 200, body: JSON.stringify({ response: response.text() }) };

    } catch (error) {
        console.error('LỖI TRONG HANDLER callGemini:', error);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};

// Bạn có thể copy lại hàm functionExecutors từ phiên bản trước.
