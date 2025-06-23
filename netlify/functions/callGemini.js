const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// --- SỬA LỖI ĐỊNH NGHĨA TOOLS THEO ĐỊNH DẠNG MỚI ---
const tools = {
  functionDeclarations: [
    {
      name: 'web_search',
      description: 'Tìm kiếm trên internet để lấy thông tin mới nhất hoặc các sự kiện gần đây.',
      parameters: {
        type: 'OBJECT',
        properties: {
          query: {
            type: 'STRING',
            description: 'Chuỗi truy vấn tìm kiếm, ví dụ: "giá vàng hôm nay"',
          },
        },
        required: ['query'],
      },
    },
    // Bạn có thể thêm các function declaration khác ở đây
  ],
};

// --- HÀM THỰC THI TOOLS ---
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
      return { error: 'Không thể thực hiện tìm kiếm trên web.' };
    }
  },
};

// Khởi tạo model và "gắn" các công cụ vào
const model = genAI.getGenerativeModel({
  model: 'gemini-1.5-flash-latest',
  tools: [tools], // Gửi tools dưới dạng một mảng chứa đối tượng tools
});

// --- HÀM HANDLER CHÍNH ---
exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405 };
    try {
        const { history, action, context } = JSON.parse(event.body);

        if (!action || !action.message) throw new Error("Yêu cầu không hợp lệ.");

        let chatHistoryForModel = [];
        if (Array.isArray(history)) {
            const validHistory = history.filter(h => h.role && h.parts && h.parts[0]?.text);
            const firstUserIndex = validHistory.findIndex(h => h.role === 'user');
            if (firstUserIndex > -1) {
                chatHistoryForModel = validHistory.slice(firstUserIndex);
            }
        }

        const chat = model.startChat({ history: chatHistoryForModel });
        
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
