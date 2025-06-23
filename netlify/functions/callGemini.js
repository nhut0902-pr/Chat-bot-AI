const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro-latest' });

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { history, context, promptType, message, imageData } = JSON.parse(event.body);

        let finalPrompt;
        let result;
        // Lấy lịch sử thô, bỏ tin nhắn cuối của user nếu là chat
        const rawHistory = promptType === 'chat' ? history.slice(0, -1) : history;

        // --- BỘ LỌC BẢO VỆ MỚI ---
        // SỬA LỖI: Đảm bảo lịch sử chat gửi đến API luôn bắt đầu bằng vai trò 'user'
        const firstUserIndex = rawHistory.findIndex(msg => msg.role === 'user');
        const chatHistoryForModel = firstUserIndex === -1 ? [] : rawHistory.slice(firstUserIndex);
        // -----------------------------

        const chat = model.startChat({
            history: chatHistoryForModel, // Dùng lịch sử đã được lọc
            generationConfig: { maxOutputTokens: 2000 },
        });

        switch (promptType) {
            case 'web_search':
                finalPrompt = `Hãy tìm kiếm trên web và trả lời câu hỏi sau một cách chi tiết và đầy đủ: "${message}"`;
                result = await chat.sendMessage(finalPrompt);
                break;

            case 'image_chat':
                const imagePart = {
                    inlineData: {
                        mimeType: 'image/jpeg',
                        data: imageData,
                    },
                };
                result = await chat.sendMessage([message, imagePart]);
                break;
            
            case 'chat':
            default:
                // Lấy tin nhắn cuối cùng từ history gốc (đã bao gồm tin nhắn mới nhất của user)
                const lastUserMessage = history[history.length - 1].parts[0].text;
                if (context) {
                    finalPrompt = `Dựa vào ngữ cảnh sau: "${context}".\n\nHãy trả lời câu hỏi của người dùng một cách thân thiện và chính xác: "${lastUserMessage}"`;
                } else {
                    finalPrompt = `Hãy trả lời câu hỏi sau một cách thân thiện: "${lastUserMessage}"`;
                }
                result = await chat.sendMessage(finalPrompt);
                break;
        }

        const responseText = await result.response.text();

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ response: responseText }),
        };

    } catch (error) {
        console.error('!!! LỖI NGHIÊM TRỌNG TRONG FUNCTION callGemini:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: `Lỗi từ server: ${error.message}` }),
        };
    }
};
