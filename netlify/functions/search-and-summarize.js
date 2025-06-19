const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { query } = JSON.parse(event.body);
        
        const fakeSearchResults = `
            Nguồn 1 (Wikipedia): Gemini là một dòng mô hình ngôn ngữ lớn đa phương thức được phát triển bởi Google DeepMind.
            Nguồn 2 (Blog Công nghệ): Gemini 1.5 Flash nổi bật với tốc độ xử lý nhanh và cửa sổ ngữ cảnh lên tới 1 triệu token.
        `;

        const prompt = `Dựa vào thông tin sau, hãy tóm tắt câu trả lời cho câu hỏi: "${query}".\n\nThông tin: ${fakeSearchResults}\n\nHãy trình bày mạch lạc và liệt kê các nguồn đã sử dụng.`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
                response: text,
                sources: ["Wikipedia", "Blog Công nghệ"],
            }),
        };
    } catch (error) {
        console.error('Lỗi trong Netlify function (search):', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Đã xảy ra lỗi khi thực hiện tìm kiếm' }),
        };
    }
};
