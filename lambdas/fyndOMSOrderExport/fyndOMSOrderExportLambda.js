const AWS = require('aws-sdk');
var xmljs = require('xml-js');
const util = require('./utility')
exports.handler = async (event) => {
    try {
        console.log("Incoming fyndOMSOrderExportLambda payload", JSON.stringify(event));
        // Logging Enable
        await Promise.all(event.Records.map(async (record) => {
            const recordBody = JSON.parse(record.body || '{}');
            console.log("Record Body", JSON.stringify(recordBody));
            const getFyndAuthToken = util.authorisationToken();
            const orderId= recordBody.payload.order.order_id;
            const getOrderDetails = util.getOrderById(orderId,getFyndAuthToken);

            const transformedOrder = util.orderTransformer(recordBody);
            

            const mappedOrderXML = util.xmlcreator(transformedOrder);
            // Send to S3 bucket
            
          }));
    } catch (e) {
        console.error('Error crud Lov:', e.toString());
    }
};
