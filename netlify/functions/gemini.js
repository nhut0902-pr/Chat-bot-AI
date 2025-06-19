// gemini.js - PHIÊN BẢN SỬA LỖI STATUS CODE 0
const { GoogleGenerativeAI } = require("@google/generative-ai");

exports.handler = async function (event) {
    // Chỉ cho phép phương thức POST
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: 'Method Not Allowed',
        };
    }

    try {
        const { prompt, history = [] } = JSON.parse(event.body);

        if (!prompt) {
            return { statusCode: 400, body: 'Prompt is required.' };
        }

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const chat = model.startChat({ history });

        const result = await chat.sendMessageStream(prompt);

        // Tạo một ReadableStream để gửi lại cho client
        const stream = new ReadableStream({
            async start(controller) {
                for await (const chunk of result.stream) {
                    controller.enqueue(new TextEncoder().encode(chunk.text()));
                }
                controller.close();
            }
        });
        
        // Trả về một đối tượng Response hợp lệ cho streaming
        // Cách này hoạt động tốt hơn trong môi trường Netlify
        return {
            statusCode: 200,
            headers: {
                "Content-Type": "text/plain; charset=utf-8",
            },
            body: stream,
            isBase64Encoded: false,
        };

    } catch (error) {
        console.error("LOI TRONG FUNCTION:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: "An error occurred inside the Gemini function.",
                error: {
                    name: error.name,
                    message: error.message,
                }
            }),
        };
    }
};
