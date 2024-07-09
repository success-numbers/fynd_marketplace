const AWS = require('aws-sdk');
const sqs = new AWS.SQS({ region: process.env.REGION });

exports.handler = async (event) => {
    try {
        const data = JSON.parse(event.body)
        console.log('event.body ====> ', data)

        let params = {
            MessageBody: JSON.stringify(data),
        };

        if (data.event.name === 'order' && data.event.type === 'placed') {
            params.QueueUrl = process.env.fyndOrderExportSQS
        } else {
            params.QueueUrl = process.env.fyndOrderUpdatesSQS
        }

        console.log('SQS params = ', params)
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
