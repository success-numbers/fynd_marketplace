const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const xml2js = require('xml2js');

const processFile = async (s3key, s3Bucket) => {
    // Parameters for S3 getObject
    const params = {
        Bucket: s3Bucket,
        Key: s3key
    };

    try {
        // Get XML file from S3
        const data = await s3.getObject(params).promise();
        const xml = data.Body.toString('utf-8');

        // Convert XML data to JSON
        const xmlJsonData = await xml2js.parseStringPromise(xml);
        const orders = xmlJsonData.orders.order;
        
        orders.sort((a, b) => {
            const dateA = new Date(a["custom-attributes"][0]["custom-attribute"][0]["_"]);
            const dateB = new Date(b["custom-attributes"][0]["custom-attribute"][0]["_"]);
            return dateA - dateB;
        });

        console.log('Converted JSON sorted orders array:', JSON.stringify(orders, null, 2));
        
        orders.forEach(order => {
            console.log(order["$"]["order-no"], new Date(order["custom-attributes"][0]["custom-attribute"][0]["_"]));
        });

    } catch (error) {
        console.error('Error processing file from S3:', error);
        throw error;
    }
};

module.exports = {
    processFile,
};
