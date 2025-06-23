const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');

// Khởi tạo model với API Key từ biến môi trường
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// --- ĐỊNH NGHĨA CÁC CÔNG CỤ (TOOLS) MÀ GEMINI CÓ THỂ SỬ DỤNG ---
const tools = [{
  functionDeclarations: [{
    name: 'web_search',
    description: 'Tìm kiếm trên internet để lấy thông tin mới nhất hoặc các sự kiện gần đây.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: {
          type: 'STRING',
          description: 'Chuỗi truy vấn tìm kiếm, ví dụ: "giá vàng hôm nay", "tóm tắt phim Dune 2"',
        },
      },
      required: ['query'],
    },
  }],
}];

// --- CÁC HÀM THỰC THI CÔNG CỤ TƯƠNG ỨNG ---
const functionExecutors = {
  web_search: async ({ query }) => {
    try {
      const apiKey = process.env.SERPER_API_KEY;
      if (!apiKey) {
        throw new Error("SERPER_API_KEY chưa được thiết lập trên Netlify.");
      }
      // Gọi đến API của Serper.dev
      const response = await axios.post('https://google.serper.dev/search', 
        { q: query },
        { headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' } }
      );
      // Xử lý và chỉ lấy 3-5 kết quả đầu tiên cho ngắn gọn
      const usefulResults = response.data.organic.slice(0, 3).map(item => ({
        title: item.title,
        snippet: item.snippet,
        link: item.link
      }));
      // Trả về một đối tượng JSON để Gemini đọc và tổng hợp
      return { results: usefulResults };
    } catch (error) {
      console.error("Lỗi khi gọi Serper API:", error.response ? error.response.data : error.message);
      return { error: 'Không thể thực hiện tìm kiếm trên web tại thời điểm này.' };
    }
  },
};

// Khởi tạo model Gemini và "gắn" các công cụ vào
const model = genAI.getGenerativeModel({
  model: 'gemini-1.5-flash-latest',
  tools: tools,
});

// --- HÀM HANDLER CHÍNH CỦA NETLIFY FUNCTION ---
exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { history } = JSON.parse(event.body);

        // Lọc lịch sử để đảm bảo tính hợp lệ
        const conversationHistory = history.filter(h => (h.role === 'user' || h.role === 'model') && h.parts && h.parts[0].text);
        
        // Bắt đầu phiên chat
        const chat = model.startChat({ history: conversationHistory });
        
        // Luôn lấy tin nhắn cuối cùng để gửi đi
        const lastUserMessage = history[history.length - 1]?.parts[0]?.text || "Xin chào";

        // Gửi tin nhắn đến Gemini
        const result = await chat.sendMessage(lastUserMessage);
        let response = result.response;

        // Xử lý nếu Gemini yêu cầu gọi hàm (Function Calling)
        const functionCalls = response.functionCalls();
        if (functionCalls && functionCalls.length > 0) {
            const call = functionCalls[0];
            const executor = functionExecutors[call.name];
            
            if (executor) {
                // Thực thi hàm tương ứng (ví dụ: web_search)
                const apiResponse = await executor(call.args);
                
                // Gửi kết quả của hàm trở lại cho Gemini
                const result2 = await chat.sendMessage([{
                    functionResponse: { name: call.name, response: apiResponse },
                }]);
                response = result2.response; // Lấy phản hồi cuối cùng sau khi Gemini đã có dữ liệu
            }
        }
        
        // Trả về câu trả lời cuối cùng của Gemini
        return { statusCode: 200, body: JSON.stringify({ response: response.text() }) };

    } catch (error) {
        console.error('LỖI TRONG HANDLER callGemini:', error);
        return { statusCode: 500, body: JSON.stringify({ error: `Lỗi từ server: ${error.message}` }) };
    }
};
