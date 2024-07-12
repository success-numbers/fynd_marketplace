const AWS = require('aws-sdk')
const xmljs = require('xml-js')
const s3 = new AWS.S3()

const orderTransformer = (eventData) => {
  const { payload: { shipment } } = eventData

  const orderId = shipment.order_id
  const returnInfo = {
    'returnInfo': [
      getReturnInfo(shipment)
    ]
  }

  let data = {
    orders: [
      {
        order: {
          _attributes: {
            'order-no': orderId
          },
          'product-lineitems': [
            {
              'product-lineitem': {
                'custom-attributes': [
                  {
                    'custom-attribute': {
                      _attributes: {
                        'attribute-id': 'returnInfo'
                      },
                      _text: JSON.stringify(returnInfo)
                    }
                  }
                ]
              }
            }
          ]
        }
      }
    ]
  }

  return data
}


const getReturnInfo = (shipment) => {
  const billAddr = shipment.billing_address
  const { firstName, lastName } = getFirstAndLastName(billAddr.name)

  const returnReason = getReason(shipment.bag_status_history)

  let data = {
    OrderID: shipment.order_id,
    reason: returnReason,
    bankName: '', // TODO
    bankAccountOwner: '', // TODO
    IBANNo: '', // TODO
    firstName,
    lastName,
    address1: billAddr.address1,
    city: billAddr.city,
    district: '',
    postalCode: billAddr.pincode,
    countryCode: billAddr.country_iso_code,
    RMA_NBR: '', // TODO: ask from NICE => what to map
    return_source: 'WEB',
    fullOrderReturn: true,
    items: getItems(shipment.bags)
  }

  return data
}

const getReason = (bag_status_history) => {
  let reason = ''
  bag_status_history.forEach(history => {
    if (history.status === 'return_initiated') {
      reason = history.reasons[0].display_name
    }
  })
  return reason
}

const getItems = (bags) => {
  let data = []

  bags.forEach((bag, idx) => {
    let item = bag.item
    data.push({
      productId: item.id,
      returnedQty: `${bag.quantity}`,
      position: idx + 1,
    })
  })
  return data
}

const getFirstAndLastName = (data) => {
  data = data.trim()
  const parts = data.split(' ')

  let firstName = ''
  let lastName = ''

  if (parts.length === 1) {
    firstName = parts[0]
    lastName = ''
  } else if (parts.length === 2) {
    firstName = parts[0]
    lastName = parts[1]
  } else {
    firstName = parts.slice(0, parts.length - 1).join(' ')
    lastName = parts[parts.length - 1]
  }

  return { firstName, lastName }
}

const xmlProcessor = async (jsonObj) => {
  // Convert JSON to XML
  var options = { compact: true, ignoreComment: true, spaces: 4 }
  var xml = xmljs.json2xml(jsonObj, options)
  xml = '<?xml version="1.0" encoding="UTF-8"?>\n' + xml
  console.log("XML FORMAT TRANSFORMED ORDER", xml)

  // SEND TO S3 Bucket
  const params = {
    Bucket: process.env.SYNC_BUCKET_NAME,
    Key: `OrderUpdates/ReturnOrders/order_return_nice_fynd_${jsonObj["orders"][0]["order"]['_attributes']["order-no"]}_${Date.now()}.xml`,
    Body: xml,
    ContentType: "application/xml",
  }
  await s3.putObject(params).promise()
  console.log("Successfully uploaded file to S3 Bucket")
}