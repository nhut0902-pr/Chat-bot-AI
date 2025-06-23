const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// --- ĐỊNH NGHĨA TOOLS ---
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
              description: 'Chuỗi truy vấn tìm kiếm, ví dụ: "giá vàng hôm nay"',
            },
          },
          required: ['query'],
        },
      },
      // Bạn có thể thêm các tool khác ở đây, ví dụ get_current_weather
    ],
  },
];

// --- HÀM THỰC THI TOOLS ---
const functionExecutors = {
  web_search: async ({ query }) => {
    try {
      const apiKey = process.env.SERPER_API_KEY;
      const response = await axios.post('https://google.serper.dev/search', 
        { q: query },
        { headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' } }
      );
      const usefulResults = response.data.organic.slice(0, 5).map(item => ({
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

// --- HÀM HANDLER CHÍNH ---
exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }
    try {
        const { history } = JSON.parse(event.body);

        // --- BỘ LỌC LỊCH SỬ CHAT HOÀN CHỈNH ---
        // 1. Loại bỏ các tin nhắn không hợp lệ (không có parts hoặc parts rỗng)
        let validHistory = history.filter(msg => msg.parts && msg.parts.length > 0 && msg.parts[0].text);

        // 2. Tìm index của tin nhắn 'user' đầu tiên
        const firstUserIndex = validHistory.findIndex(msg => msg.role === 'user');
        
        // 3. Nếu không có tin 'user' nào, chỉ lấy tin nhắn cuối cùng (nếu có) để làm prompt
        if (firstUserIndex === -1) {
            const lastMessage = validHistory.length > 0 ? validHistory[validHistory.length - 1].parts[0].text : "Xin chào";
            const result = await model.generateContent(lastMessage);
            return { statusCode: 200, body: JSON.stringify({ response: result.response.text() }) };
        }

        // 4. Cắt lịch sử để đảm bảo nó bắt đầu bằng 'user'
        const chatHistoryForModel = validHistory.slice(firstUserIndex);
        
        // 5. Lấy tin nhắn cuối cùng của người dùng để gửi
        const lastUserMessage = chatHistoryForModel.pop(); // Lấy và xóa phần tử cuối

        // --- BẮT ĐẦU PHIÊN CHAT VỚI LỊCH SỬ SẠCH ---
        const chat = model.startChat({
            history: chatHistoryForModel,
        });

        const result = await chat.sendMessage(lastUserMessage.parts[0].text);
        let response = result.response;

        // --- XỬ LÝ FUNCTION CALLING ---
        let functionCalls = response.functionCalls();
        while (functionCalls && functionCalls.length > 0) {
            const call = functionCalls[0];
            console.log(`Yêu cầu gọi hàm: ${call.name} với tham số:`, call.args);
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
                response = result2.response;
                functionCalls = response.functionCalls(); // Kiểm tra lại xem có yêu cầu gọi hàm lồng nhau không
            } else {
                console.warn(`Không tìm thấy hàm thực thi cho: ${call.name}`);
                break; // Thoát vòng lặp nếu không có hàm thực thi
            }
        }
        
        const responseText = response.text();
        return { statusCode: 200, body: JSON.stringify({ response: responseText }) };

    } catch (error) {
        console.error('!!! LỖI NGHIÊM TRỌNG TRONG FUNCTION callGemini:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: `Lỗi từ server: ${error.message}` }),
        };
    }
};
