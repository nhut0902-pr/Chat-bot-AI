// gemini.js - PHIÊN BẢN CUỐI CÙNG, SỬA LỖI UNMARSHAL
const { GoogleGenerativeAI } = require("@google/generative-ai");

exports.handler = async function (event) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
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
        
        // QUAN TRỌNG: Trả về một đối tượng Response gốc, không phải object JS
        // Đây là cách Netlify hiểu để kích hoạt streaming.
        return new Response(stream, {
            status: 200,
            headers: {
                "Content-Type": "text/plain; charset=utf-8",
            },
        });

    } catch (error) {
        console.error("LOI TRONG FUNCTION:", error);
        // Khi có lỗi, trả về một object JS bình thường
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: "An error occurred inside the Gemini function.",
                errorName: error.name,
                errorMessage: error.message,
            }),
        };
    }
};
