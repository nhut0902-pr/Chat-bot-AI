// netlify/functions/callGemini.js

const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// --- ĐỊNH NGHĨA CÁC CÔNG CỤ (TOOLS) ---
const tools = [
  {
    functionDeclarations: [
      {
        name: 'web_search',
        description: 'Tìm kiếm trên internet để lấy thông tin mới nhất hoặc thông tin về các sự kiện gần đây.',
        parameters: {
          type: 'OBJECT',
          properties: {
            query: {
              type: 'STRING',
              description: 'Chuỗi truy vấn tìm kiếm, ví dụ: "kết quả bóng đá hôm qua"',
            },
          },
          required: ['query'],
        },
      },
      // Bạn vẫn có thể giữ công cụ get_current_weather ở đây
    ],
  },
];

// --- HÀM THỰC THI CÔNG CỤ ---
const functionExecutors = {
  web_search: async ({ query }) => {
    try {
      console.log(`Đang thực hiện tìm kiếm với truy vấn: ${query}`);
      const apiKey = process.env.SERPER_API_KEY;
      const response = await axios.post('https://google.serper.dev/search', {
        q: query,
      }, {
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json',
        },
      });

      // Lấy các kết quả tìm kiếm hữu ích (tiêu đề, link, đoạn trích)
      const usefulResults = response.data.organic.slice(0, 5).map(item => ({
        title: item.title,
        snippet: item.snippet,
      }));

      console.log("Kết quả tìm kiếm đã được xử lý:", usefulResults);
      // Trả về một đối tượng JSON chứa các kết quả đã được tóm tắt
      return { results: usefulResults };

    } catch (error) {
      console.error("Lỗi khi gọi Serper API:", error);
      return { error: 'Không thể thực hiện tìm kiếm trên web.' };
    }
  },
  // Hàm get_current_weather của bạn ở đây...
};

// Gắn tools vào model
const model = genAI.getGenerativeModel({
  model: 'gemini-1.5-flash-latest',
  tools: tools,
});

// --- PHẦN exports.handler ---
// Luồng xử lý exports.handler sẽ tương tự như luồng xử lý thời tiết
// Nó sẽ kiểm tra functionCalls, tìm đúng executor là 'web_search' và chạy nó
// Sau đó gửi kết quả từ Serper API ngược lại cho Gemini để tổng hợp câu trả lời.

exports.handler = async (event) => {
    try {
        const { history } = JSON.parse(event.body);
        const lastUserMessage = history[history.length - 1];
        const chatHistoryForModel = history.slice(0, -1);

        const chat = model.startChat({
            history: chatHistoryForModel,
        });

        const result = await chat.sendMessage(lastUserMessage.parts[0].text);
        const response = result.response;

        const functionCalls = response.functionCalls();
        if (functionCalls && functionCalls.length > 0) {
            const call = functionCalls[0];
            const executor = functionExecutors[call.name];
            if (executor) {
                const apiResponse = await executor(call.args);
                const result2 = await chat.sendMessage([
                    {
                        functionResponse: {
                            name: call.name,
                            response: apiResponse,
                        },
                    },
                ]);
                const finalResponseText = result2.response.text();
                return { statusCode: 200, body: JSON.stringify({ response: finalResponseText }) };
            }
        }
        
        const responseText = response.text();
        return { statusCode: 200, body: JSON.stringify({ response: responseText }) };

    } catch (error) {
        console.error('Lỗi trong function callGemini:', error);
        return { statusCode: 500, body: JSON.stringify({ error: `Lỗi từ server: ${error.message}` }) };
    }
};
