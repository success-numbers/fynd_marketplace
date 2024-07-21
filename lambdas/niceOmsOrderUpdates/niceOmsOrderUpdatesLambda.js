const AWS = require('aws-sdk')

exports.handler = async (event) => {
    try {
        console.log("Incoming niceOmsOrderUpdatesLambda payload", JSON.stringify(event));
        
        await Promise.all(event.Records.map(async (record) => {
            console.log("RECORD", record)
            const recordBody = JSON.parse(record.body || {});
            console.log("Record Body", JSON.stringify(recordBody));
          }));
    } catch (e) {
        console.error('Error in niceOmsOrderUpdates Lambda:', e.toString());
        throw e;  // Throwing error to indicate failure to SQS
    }
};
