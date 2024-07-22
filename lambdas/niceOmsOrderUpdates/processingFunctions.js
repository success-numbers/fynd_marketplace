const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const xml2js = require('xml2js');
const axios = require('axios');

const niceToFyndStatusMapper = {
  'INTRANSIT': ['bag_confirmed'],
  'SHIPPED': ['dp_assigned', 'bag_packed']
}

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

    let requests = formRequestPayload(orders);
    await sendRequests(requests);
  } catch (error) {
    console.error('Error processing file from S3:', error);
    throw error;
  }
};

const formRequestPayload = (orders) => {
  let requests = [];

  for (const order of orders) {
    console.log(order["$"]["order-no"], new Date(order["custom-attributes"][0]["custom-attribute"][0]["_"]));

    const orderNo = order["$"]["order-no"]
    const orderStatus = order["status"][0]["order-status"][0]
    const shippingStatus = order["status"][0]["shipping-status"][0]
    const externalOrderStatus = order["status"][0]["external-order-status"][0]

    niceToFyndStatusMapper[shippingStatus] && niceToFyndStatusMapper[shippingStatus].forEach((fyndStatus) => {
      let payload = {
        statuses: [
          {
            status: fyndStatus,
            shipments: [
              {
                identifier: orderNo,
              }
            ]
          }
        ],
        force_transition: false,
        lock_after_transition: false,
        unlock_before_transition: false,
        task: false
      }

      requests.push(payload);
    })
  };

  return requests;
}

const sendRequests = async (requestsArray) => {
  const authToken = await getAuthorisationToken();
  for (const requestData of requestsArray) {
    try {
      const companyId = '7251';
      const url = `https://api.fynd.com/service/platform/order-manage/v1.0/company/${ companyId }/shipment/status-internal`;
      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Cookie': '{{cookies}}',  // Replace with actual cookies if needed
        'Authorization': `Bearer ${authToken}`,
      };
      const { data } = await axios.put(url, requestData, { headers });
      console.log('response = ', data)
    } catch (error) {
      console.error('Error processing request = ', JSON.stringify(requestData));
      console.error('Error = ', error);
      throw error;
    }
  };
};

const getAuthorisationToken = async () => {
  const url =
    "https://api.fynd.com/service/panel/authentication/v1.0/company/7251/oauth/token";
  const headers = {
    "Content-Type": "application/json",
    Authorization: "Bearer oa-78c24c00b5d774dcde1a0cd1044f6db6615ef2dc",
  };

  const data = {
    client_id: "6620edf33da73848580ff4ba",
    client_secret: "9cA0QLL4c.af4RH",
    grant_type: "client_credentials",
  };

  try {
    const response = await axios.post(url, data, { headers });
    return response.data?.access_token ?? "";
  } catch (error) {
    console.error('Error generating access token', error);
    throw error;
  }
};

module.exports = {
  processFile,
};
