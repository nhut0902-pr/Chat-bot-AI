const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { history, context, promptType, message } = JSON.parse(event.body);

        if (!history) {
            return { statusCode: 400, body: 'Lịch sử chat là bắt buộc.' };
        }

        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        
        // Lấy lịch sử trò chuyện (không bao gồm tin nhắn cuối cùng của user nếu là chat)
        const chatHistoryForModel = promptType === 'chat' ? history.slice(0, -1) : history;

        const chat = model.startChat({
            history: chatHistoryForModel,
            generationConfig: { maxOutputTokens: 1500 },
        });

        // Xây dựng prompt cuối cùng dựa vào loại yêu cầu
        let finalPrompt;
        switch (promptType) {
            case 'summarize':
                finalPrompt = `Dựa vào ngữ cảnh sau: "${context}".\nHãy tóm tắt nội dung chính một cách súc tích, rõ ràng theo các gạch đầu dòng.`;
                break;
            case 'quiz':
                finalPrompt = `Dựa vào ngữ cảnh sau: "${context}".\nHãy tạo ra 5 câu hỏi trắc nghiệm (với 4 đáp án A, B, C, D) để kiểm tra kiến thức, kèm theo đáp án đúng ở cuối mỗi câu.`;
                break;
            case 'chat':
            default:
                if (context) {
                    finalPrompt = `Dựa vào ngữ cảnh sau: "${context}".\n\nHãy trả lời câu hỏi của người dùng một cách thân thiện và chính xác: "${message}"`;
                } else {
                    finalPrompt = `Hãy trả lời câu hỏi sau một cách thân thiện: "${message}"`;
                }
                break;
        }

        const result = await chat.sendMessage(finalPrompt);
        const responseText = await result.response.text();

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ response: responseText }),
        };

    } catch (error) {
        console.error('Lỗi API Gemini:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Đã có lỗi xảy ra với API của Gemini.' }),
        };
    }
};
