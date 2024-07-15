const AWS = require('aws-sdk')
const xmljs = require('xml-js')
const s3 = new AWS.S3()

exports.orderReturnTransformer = (eventData) => {
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

  return { transformedPayload: data, s3PathKey: `OrderUpdates/ReturnOrders/order_return_nice_fynd_${orderId}_${Date.now()}.xml` }
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
