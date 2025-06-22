const formidable = require('formidable-serverless');
const fs = require('fs');
const pdf = require('pdf-parse');

exports.handler = async (event) => {
    const form = new formidable.IncomingForm();
    
    return new Promise((resolve, reject) => {
        form.parse(event, (err, fields, files) => {
            if (err) {
                return resolve({ statusCode: 500, body: JSON.stringify({ error: 'Lỗi khi parse file.' }) });
            }

            const pdfFile = files.file;
            if (!pdfFile) {
                 return resolve({ statusCode: 400, body: JSON.stringify({ error: 'Không tìm thấy file.' }) });
            }
            
            const dataBuffer = fs.readFileSync(pdfFile.path);
            
            pdf(dataBuffer).then(data => {
                resolve({
                    statusCode: 200,
                    body: JSON.stringify({ content: data.text })
                });
            }).catch(error => {
                resolve({ statusCode: 500, body: JSON.stringify({ error: 'Không thể đọc nội dung file PDF.' }) });
            });
        });
    });
};
