// netlify/functions/callGemini.js

exports.handler = async function (event, context) {
    // Chỉ cho phép phương thức POST
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        // Lấy API key từ biến môi trường của Netlify (AN TOÀN)
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

        if (!GEMINI_API_KEY) {
            throw new Error("API key chưa được cấu hình trên server.");
        }

        // Lấy dữ liệu (prompt và file) từ request của frontend
        const { prompt, file } = JSON.parse(event.body);

        const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

        // Xây dựng payload cho Google API
        let contents = [{ parts: [] }];
        if (prompt) {
            contents[0].parts.push({ text: prompt });
        }
        if (file) {
            // File đã được gửi dưới dạng base64 từ frontend
            contents[0].parts.push({ inline_data: { mime_type: file.type, data: file.data } });
        }

        // Gọi đến API của Google từ server của Netlify
        const geminiResponse = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ contents })
        });

        if (!geminiResponse.ok) {
            const errorData = await geminiResponse.json();
            console.error("Lỗi từ Google API:", errorData);
            return {
                statusCode: geminiResponse.status,
                body: JSON.stringify({ error: errorData.error.message || "Lỗi không xác định từ Google API." })
            };
        }

        const responseData = await geminiResponse.json();
        
        // Trả kết quả về cho frontend
        return {
            statusCode: 200,
            body: JSON.stringify(responseData)
        };

    } catch (error) {
        console.error("Lỗi trong Netlify function:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
