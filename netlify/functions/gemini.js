const { GoogleGenerativeAI } = require('@google/generative-ai');

// Khởi tạo Google Generative AI với API Key từ biến môi trường của Netlify
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

exports.handler = async (event) => {
    // Netlify Functions chỉ chấp nhận phương thức POST cho các yêu cầu có body
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { history, prompt, imageBase64 } = JSON.parse(event.body);

        const parts = [{ text: prompt }];

        if (imageBase64) {
            const imagePart = {
                inlineData: {
                    mimeType: 'image/jpeg',
                    data: imageBase64,
                },
            };
            parts.unshift(imagePart);
        }

        const chat = model.startChat({ history });
        const result = await chat.sendMessage(parts);
        const response = await result.response;
        const text = response.text();

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*', // Cho phép CORS
            },
            body: JSON.stringify({ response: text }),
        };
    } catch (error) {
        console.error('Lỗi trong Netlify function (chat):', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Đã xảy ra lỗi khi kết nối với AI' }),
        };
    }
};
