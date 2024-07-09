const AWS = require('aws-sdk');
const sqs = new AWS.SQS({ region: process.env.REGION });

exports.handler = async (event) => {
    try {
        const data = JSON.parse(event.body);
        console.log('event.body ====> ', data);

        const { name, type } = data.event;

        let queueUrl;
        if (name === 'order' && type === 'placed') {
            queueUrl = process.env.fyndOrderExportSQS;
        } else if (name === 'shipment' && type === 'update') {
            queueUrl = process.env.fyndOrderUpdatesSQS;
        } else {
            throw new Error('Invalid event.name and event.type');
        }

        const params = {
            MessageBody: JSON.stringify(data),
            QueueUrl: queueUrl,
        };
        console.log('SQS params = ', params);
        
        await sqs.sendMessage(params).promise();
        console.log("Event message sent to SQS successfully", params);

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                status : "OK"
            }),
        };
    } catch (e) {
        console.error(e.toString());
        const res = {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({ "message": `${e.toString()}` }),
        };
        return res;
    }
};
