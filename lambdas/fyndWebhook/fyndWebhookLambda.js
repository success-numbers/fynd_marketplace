const AWS = require('aws-sdk');
const sqs = new AWS.SQS({ region: process.env.REGION });

exports.handler = async (event) => {
    try {
        console.log('event.body ====> ', event.body)
        
        const params = {
            MessageBody: JSON.stringify(event.body),
            QueueUrl: process.env.fyndOrderExportSQS,
        };
        await sqs.sendMessage(params).promise();

        console.log("Event message sent to SQS (fyndOrderExportSQS) successfully", params);

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
