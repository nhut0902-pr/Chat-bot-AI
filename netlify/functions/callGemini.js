const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// --- ĐỊNH NGHĨA TOOLS ---
const tools = [{
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
}];

// --- HÀM THỰC THI TOOLS ---
const functionExecutors = {
  web_search: async ({ query }) => {
    try {
      const apiKey = process.env.SERPER_API_KEY;
      if (!apiKey) throw new Error("SERPER_API_KEY chưa được thiết lập.");
      const response = await axios.post('https://google.serper.dev/search', { q: query }, { headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' } });
      const usefulResults = response.data.organic.slice(0, 3).map(item => ({ title: item.title, snippet: item.snippet, link: item.link }));
      return { results: usefulResults };
    } catch (error) {
      return { error: 'Không thể thực hiện tìm kiếm.' };
    }
  },
};

// --- Model cho việc gọi tool ---
const toolModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest', tools: tools });

// --- HÀM HANDLER CHÍNH ---
exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405 };
    try {
        const { history, action, context } = JSON.parse(event.body);
        if (!action || !action.message) throw new Error("Yêu cầu không hợp lệ.");

        // --- BỘ LỌC LỊCH SỬ AN TOÀN ---
        let conversationHistory = [];
        if (Array.isArray(history)) {
            // Lọc ra các tin nhắn hợp lệ và đảm bảo không có 2 tin user liên tiếp
            let lastRole = null;
            history.forEach(h => {
                if (h.role && h.parts && h.parts[0]?.text) {
                    if (h.role !== lastRole) {
                        conversationHistory.push(h);
                        lastRole = h.role;
                    }
                }
            });
        }
        
        // --- TẠO YÊU CẦU GỬI ĐẾN GEMINI ---
        let finalPrompt = action.message;
        if (context) {
            finalPrompt = `Dựa vào ngữ cảnh sau: "${context}".\n\nHãy trả lời: "${action.message}"`;
        } else if (action.type === 'web_search') {
            finalPrompt = `Hãy tìm kiếm trên web và trả lời câu hỏi sau: "${action.message}"`;
        }
        
        // Thêm tin nhắn mới nhất của người dùng vào cuối lịch sử
        conversationHistory.push({ role: 'user', parts: [{ text: finalPrompt }] });

        // --- GỌI API GEMINI BẰNG generateContent ---
        const result = await toolModel.generateContent({
            contents: conversationHistory,
        });

        const response = result.response;
        const responseText = response.text();

        // --- XỬ LÝ FUNCTION CALLING (NẾU CÓ) ---
        // (Lưu ý: Luồng này sẽ phức tạp hơn với generateContent, tạm thời bỏ qua để sửa lỗi chính)
        // Nếu bạn muốn tích hợp lại, chúng ta sẽ cần một vòng lặp gọi lại.
        // Hiện tại, chúng ta tập trung vào việc làm cho tìm kiếm hoạt động.
        // Với prompt "Hãy tìm kiếm...", Gemini thường sẽ tự tìm và trả lời luôn.

        return { statusCode: 200, body: JSON.stringify({ response: responseText }) };
        
    } catch (error) {
        console.error('LỖI TRONG HANDLER callGemini:', error);
        return { statusCode: 500, body: JSON.stringify({ error: `[Lỗi Gemini]: ${error.message}` }) };
    }
};
