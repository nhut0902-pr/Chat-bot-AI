const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

const tools = {
  functionDeclarations: [
    {
      name: 'web_search',
      description: 'Tìm kiếm trên internet để lấy thông tin mới nhất hoặc các sự kiện gần đây.',
      parameters: {
        type: 'OBJECT',
        properties: { query: { type: 'STRING', description: 'Chuỗi truy vấn tìm kiếm' } },
        required: ['query'],
      },
    },
  ],
};

const functionExecutors = {
  web_search: async ({ query }) => {
    try {
      const apiKey = process.env.SERPER_API_KEY;
      if (!apiKey) throw new Error("SERPER_API_KEY chưa được thiết lập.");
      const response = await axios.post('https://google.serper.dev/search', 
        { q: query },
        { headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' } }
      );
      const usefulResults = response.data.organic.slice(0, 3).map(item => ({
        title: item.title,
        snippet: item.snippet,
        link: item.link
      }));
      return { results: usefulResults };
    } catch (error) {
      console.error("Lỗi khi gọi Serper API:", error.response ? error.response.data : error.message);
      return { error: 'Không thể thực hiện tìm kiếm.' };
    }
  },
};

// --- SỬA LỖI LOGIC TÌM KIẾM ---
// Tạo 2 model khác nhau: một cho chat thường, một ÉP BUỘC phải dùng tool
const generativeModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });
const toolModel = genAI.getGenerativeModel({
  model: 'gemini-1.5-flash-latest',
  tools: [tools],
  // Ép buộc model phải chọn một tool để trả lời
  toolConfig: { functionCallingConfig: { mode: "ANY" } }
});

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405 };
    try {
        const { history, action, context } = JSON.parse(event.body);
        if (!action || !action.message) throw new Error("Yêu cầu không hợp lệ.");

        let chatHistoryForModel = [];
        if (Array.isArray(history)) {
            const validHistory = history.filter(h => h.role && h.parts && h.parts[0]?.text);
            const firstUserIndex = validHistory.findIndex(h => h.role === 'user');
            if (firstUserIndex > -1) chatHistoryForModel = validHistory.slice(firstUserIndex);
        }

        let modelToUse;
        let finalPrompt = action.message;

        // Chọn model và prompt dựa trên hành động của người dùng
        if (action.type === 'web_search') {
            modelToUse = toolModel; // Dùng model được ép buộc sử dụng tool
            // Prompt không cần thêm gì, vì model sẽ tự hiểu cần gọi tool `web_search`
        } else {
            modelToUse = generativeModel; // Dùng model chat thường
            if (context) {
                finalPrompt = `Dựa vào ngữ cảnh sau: "${context}".\n\nHãy trả lời: "${action.message}"`;
            }
        }
        
        const chat = modelToUse.startChat({ history: chatHistoryForModel });
        const result = await chat.sendMessage(finalPrompt);
        let response = result.response;

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
        return { statusCode: 500, body: JSON.stringify({ error: `[Lỗi Gemini]: ${error.message}` }) };
    }
};
