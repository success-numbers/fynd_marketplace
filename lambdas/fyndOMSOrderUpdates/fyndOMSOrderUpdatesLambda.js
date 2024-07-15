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
            
            const  { transformedPayload, s3PathKey } = await util.statusFlowConsumer(recordBody, getFyndAuthToken)
            console.log("MEOW TRANSFORMED ORDER", JSON.stringify(transformedPayload))

            if (!transformedPayload) {
                console.log('IGNORING this payload')
                return
            }

            await util.xmlProcessor(transformedPayload, s3PathKey);
          }));
    } catch (e) {
        console.error('Error in fyndOMSOrderUpdates Lambda:', e.toString());
        throw e;  // Throwing error to indicate failure to SQS
    }
};
