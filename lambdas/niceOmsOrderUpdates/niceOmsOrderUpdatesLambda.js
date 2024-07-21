const { processFile } = require('./processingFunctions');

exports.handler = async (event) => {
    try {
        console.log("Incoming niceOmsOrderUpdatesLambda payload", JSON.stringify(event));

        await Promise.all(event.Records.map(async (sqsRecord) => {
            const sqsRecordBody = JSON.parse(sqsRecord.body || '{}');
            const s3Records = sqsRecordBody.Records || [];
            console.log("s3Records = ", s3Records);

            await Promise.all(s3Records.map(async (record) => {
                // console.log("record = ", record);
                console.log("eventName = ", record.eventName);
                const s3key = record?.s3?.object?.key;
                const s3Bucket = record?.s3?.bucket?.name;
                
                if (!s3key) {
                    console.log("s3key not present in record");
                    return;
                }

                console.log("s3key = ", s3key);
                console.log("s3Bucket = ", s3Bucket);

                try {
                    await processFile(s3key, s3Bucket);
                } catch (e) {
                    console.error('Error processing file:', s3key, 'from bucket:', s3Bucket, '-', e.message);
                    throw new Error(`Error processing file: ${e.message}`);
                }
            }));

        }));

    } catch (e) {
        console.error('Error in niceOmsOrderUpdatesLambda: ', e.message);
        throw e;
    }
};
