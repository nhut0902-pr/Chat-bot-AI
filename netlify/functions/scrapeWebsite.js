const axios = require('axios');
const cheerio = require('cheerio');

exports.handler = async (event) => {
    try {
        const { url } = JSON.parse(event.body);
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);
        
        // Loại bỏ các thẻ không cần thiết
        $('script, style, nav, footer, header, aside').remove();
        
        // Lấy text từ các thẻ phổ biến chứa nội dung
        let content = '';
        $('h1, h2, h3, p, li, article').each((i, elem) => {
            content += $(elem).text().trim() + '\n';
        });

        return {
            statusCode: 200,
            body: JSON.stringify({ content: content }),
        };
    } catch (error) {
         return { statusCode: 500, body: JSON.stringify({ error: 'Không thể lấy nội dung từ trang web. Vui lòng kiểm tra lại URL.' })};
    }
};
