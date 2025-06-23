const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

const tools = [{
  functionDeclarations: [{
    name: 'web_search',
    description: 'Tìm kiếm trên internet để lấy thông tin mới nhất hoặc thông tin về các sự kiện gần đây.',
    parameters: {
      type: 'OBJECT',
      properties: { query: { type: 'STRING', description: 'Chuỗi truy vấn tìm kiếm' } },
      required: ['query'],
    },
  }],
}];

const functionExecutors = {
  web_search: async ({ query }) => {
    try {
      const apiKey = process.env.SERPER_API_KEY;
      if (!apiKey) throw new Error("SERPER_API_KEY is not set.");
      const response = await axios.post('https://google.serper.dev/search', 
        { q: query },
        { headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' } }
      );
      const usefulResults = response.data.organic.slice(0, 3).map(item => ({
        title: item.title,
        snippet: item.snippet,
      }));
      return { results: usefulResults };
    } catch (error) {
      console.error("Lỗi khi gọi Serper API:", error.response ? error.response.data : error.message);
      return { error: 'Không thể thực hiện tìm kiếm trên web.' };
    }
  },
};

const model = genAI.getGenerativeModel({
  model: 'gemini-1.5-flash-latest',
  tools: tools,
});

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }
    try {
        const { history } = JSON.parse(event.body);

        // --- BỘ LỌC ĐƠN GIẢN VÀ HIỆU QUẢ ---
        // Chỉ lấy các tin nhắn của user và model
        const conversationHistory = history.filter(h => h.role === 'user' || h.role === 'model');

        // Nếu không có lịch sử, hoặc lịch sử không bắt đầu bằng 'user', sẽ không gửi history
        let historyForChat;
        if (conversationHistory.length > 0 && conversationHistory[0].role === 'user') {
            historyForChat = conversationHistory;
        } else {
            historyForChat = []; // Gửi mảng rỗng nếu lịch sử không hợp lệ
        }

        const chat = model.startChat({ history: historyForChat });
        
        // Luôn lấy tin nhắn cuối cùng để gửi
        const lastUserMessage = history[history.length - 1]?.parts[0]?.text || "Xin chào";

        const result = await chat.sendMessage(lastUserMessage);
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
        console.error('LỖI TRONG HANDLER:', error);
        return { statusCode: 500, body: JSON.stringify({ error: `Lỗi từ server: ${error.message}` }) };
    }
};
