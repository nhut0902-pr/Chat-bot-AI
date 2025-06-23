const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// --- THAY ĐỔI DUY NHẤT Ở ĐÂY ---
// Chuyển từ "gemini-1.5-pro-latest" sang "gemini-1.5-flash-latest"
// Model này nhanh hơn, tiết kiệm quota hơn, và vẫn rất mạnh mẽ.
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });
// ---------------------------------

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { history, context, promptType, message, imageData } = JSON.parse(event.body);

        let finalPrompt;
        let result;
        const rawHistory = promptType === 'chat' ? history.slice(0, -1) : history;

        const firstUserIndex = rawHistory.findIndex(msg => msg.role === 'user');
        const chatHistoryForModel = firstUserIndex === -1 ? [] : rawHistory.slice(firstUserIndex);

        const chat = model.startChat({
            history: chatHistoryForModel,
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
