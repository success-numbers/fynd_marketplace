const AWS = require('aws-sdk')
const util = require('./utility')

exports.handler = async (event) => {
    try {
        console.log("Incoming fyndOMSOrderUpdatesLambda payload", JSON.stringify(event));
        
        await Promise.all(event.Records.map(async (record) => {
            console.log("MEOW RECORD", record)
            const recordBody = JSON.parse(record.body);
            console.log("Record Body", JSON.stringify(recordBody));
            const getFyndAuthToken = await util.authorisationToken();
            console.log("MEOW getFyndAuthToken",getFyndAuthToken)
            const  { transformedPayload, s3Path } = await util.statusFlowConsumer(recordBody, getFyndAuthToken)
            console.log("MEOW TRANSFORMED ORDER", JSON.stringify(transformedPayload))
            await util.xmlProcessor(transformedPayload, s3Path);
          }));
    } catch (e) {
        console.error('Error in fyndOMSOrderUpdates Lambda:', e.toString());
        throw e;  // Throwing error to indicate failure to SQS
    }
};
