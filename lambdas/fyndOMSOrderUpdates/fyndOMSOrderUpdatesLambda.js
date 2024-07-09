const AWS = require('aws-sdk')
const util = require('./utility')

exports.handler = async (event) => {
    try {
        console.log("Incoming fyndOMSOrderUpdatesLambda payload", JSON.stringify(event));
        
        await Promise.all(event.Records.map(async (record) => {
            const recordBody = JSON.parse(record.body || '{}');
            console.log("Record Body", recordBody);
            // const getFyndAuthToken = await util.authorisationToken();
            // const orderId= recordBody.payload.order.order_id;
            // const getOrderDetails = await util.getOrderById(orderId, getFyndAuthToken);
            // const transformedOrder = util.orderTransformer(recordBody,getOrderDetails);
            // console.log("TRANSFORMED ORDER JSON", JSON.stringify(transformedOrder));
            // // XML conversion & Send to S3 bucket
            // await util.xmlProcessor(transformedOrder);
        
          }));
    } catch (e) {
        console.error('Error in fyndOMSOrderUpdates Lambda:', e.toString());
        throw e;  // Throwing error to indicate failure to SQS
    }
};
