const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');

// Khởi tạo model với API Key từ biến môi trường
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// --- ĐỊNH NGHĨA CÁC CÔNG CỤ (TOOLS) THEO ĐỊNH DẠNG MỚI ---
const tools = [{
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
      // Xử lý và chỉ lấy 3 kết quả đầu tiên cho ngắn gọn
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
const toolModel = genAI.getGenerativeModel({
  model: 'gemini-1.5-flash-latest',
  tools: tools,
});

// --- HÀM HANDLER CHÍNH CỦA NETLIFY FUNCTION ---
exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { history, action, context } = JSON.parse(event.body);

        if (!action || !action.message) {
            throw new Error("Yêu cầu không hợp lệ. Thiếu 'action' hoặc 'message'.");
        }

        // --- BỘ LỌC LỊCH SỬ CHAT AN TOÀN ---
        let conversationHistory = [];
        if (Array.isArray(history)) {
            let lastRole = null;
            history.forEach(h => {
                if (h.role && h.parts && h.parts[0]?.text) {
                    if (h.role !== lastRole || h.role === 'function') {
                        conversationHistory.push(h);
                        lastRole = h.role;
                    } else if (h.role === 'user') {
                        conversationHistory.pop();
                        conversationHistory.push(h);
                    }
                }
            });
        }

        // --- TỐI ƯU HÓA QUOTA: Chỉ lấy 10 tin nhắn gần nhất ---
        const recentHistory = conversationHistory.slice(-10);

        // Xây dựng prompt cuối cùng
        let finalPrompt = action.message;
        if (context) {
            finalPrompt = `Dựa vào ngữ cảnh sau đây: "${context}".\n\nHãy trả lời câu hỏi: "${action.message}"`;
        } else if (action.type === 'web_search') {
            finalPrompt = `Hãy tìm kiếm trên web và trả lời câu hỏi sau: "${action.message}"`;
        }
        
        // Thêm tin nhắn mới nhất của người dùng vào cuối lịch sử đã được cắt ngắn
        recentHistory.push({ role: 'user', parts: [{ text: finalPrompt }] });

        // --- GỌI API GEMINI BẰNG generateContent ---
        const result = await toolModel.generateContent({
            contents: recentHistory, // Gửi đi lịch sử gần đây đã bao gồm tin nhắn mới
        });

        const response = result.response;
        const responseText = response.text();

        // Phần xử lý Function Calling phức tạp hơn có thể được thêm vào đây nếu cần,
        // nhưng với prompt "Hãy tìm kiếm...", Gemini thường sẽ tự xử lý.
        
        return { statusCode: 200, body: JSON.stringify({ response: responseText }) };

    } catch (error) {
        console.error('LỖI TRONG HANDLER callGemini:', error);
        return { statusCode: 500, body: JSON.stringify({ error: `[Lỗi Gemini]: ${error.message}` }) };
    }
};
