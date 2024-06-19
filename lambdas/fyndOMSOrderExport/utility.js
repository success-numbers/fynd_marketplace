const AWS = require("aws-sdk");
const axios = require("axios");
const xmljs = require("xml-js");
const s3 = new AWS.S3();

exports.orderTransformer = (orderPayload, orderData) => {
  let orders = [getOrder(orderPayload, orderData)];
  const finalPayload = {
    orders: {
      order: orders,
    },
  };
  console.log(finalPayload);

  return finalPayload;
};

const getOrder = (data, orderData) => {
  const event = data?.event;
  const order = data?.payload.order;
  const shipmentListMapped = getShipments(data, orderData);
  const orderDate = new Date(event?.created_timestamp);

  return {
    "order-date": orderDate.toISOString(),
    "created-by": "storefront",
    "original-order-no": order.order_id,
    currency: order.meta.currency.currency_code,
    "customer-locale": "ar-SA", // TODO
    taxation: "gross",
    "invoice-no": order.order_id,
    customer: getCustomer(data),
    status: getStatus(data),
    "channel-type": order.meta.order_platform,
    "current-order-no": order.order_id,
    "product-lineitems": {
      "product-lineitem": getProductLineItems(data, orderData),
    },
    "shipping-lineitems": {
      "shipping-lineitem": getShipmentLineItemDetails(data, orderData),
    },
    shipments: {
      shipment: shipmentListMapped,
    },
    totals: getTotalsOfOrder(data, orderData, shipmentListMapped),
    payments: {
      payment: getPaymentArray(data, orderData),
    },

    // notes: {
    //   note: [],
    // },
    // "custom-attributes": {
    //   // TODO
    //   "custom-attribute": [], // TODO
    // },
  };
};

// TODO: create a account and then place order to get customer detials
const getCustomer = (data) => {
  const event = data?.event;
  const order = data?.payload.order;

  let isguest = order.user.is_anonymous_user ? true : false;
  let customer = {
    guest: isguest,
  };
  const billAddr = order.shipments[0].billing_address_json;
  customer = {
    ...customer,
    // "customer-no": 433922, // TODO
    "customer-name": billAddr["first-name"],
    "customer-email": billAddr?.email ?? "",
    "billing-address": getBillingAddress(data),
  };
  return customer;
};

const getProductLineItems = (data, orderData) => {
  const order = data?.payload.order;
  const prdListItems = [];
  let prdLinPosition = 1;
  order.shipments.forEach((shipment) => {
    // Shipment level
    const shipmentId = shipment?.id;
    const shipmentLvlInfoFromApi = orderData.shipments.find(
      (e) => e.shipment_id == shipmentId
    );
    console.log(
      "MEOW getProductLineItems ===> shipmentLvlInfoFromApi",
      JSON.stringify(shipmentLvlInfoFromApi)
    );
    shipment.bags.forEach((item) => {
      const itemDataFromApi = shipmentLvlInfoFromApi.bags.find(
        (e) =>
          e.article.identifiers.ean == item.article_json.identifier.ean &&
          e.item.id == item.article_json.item_id
      );
      prdListItems.push({
        "net-price": itemDataFromApi.financial_breakup.value_of_good,
        tax: itemDataFromApi.financial_breakup.gst_fee,
        "gross-price": itemDataFromApi.financial_breakup.price_effective,
        "base-price": itemDataFromApi.financial_breakup.price_effective,
        "lineitem-text": `${item.item?.name}`,
        "tax-basis": itemDataFromApi.financial_breakup.price_effective,
        position: prdLinPosition,
        "product-id": item.item?.id,
        "product-name": `${item.item?.name}`,
        quantity: item?.quantity,
        "tax-rate": itemDataFromApi.financial_breakup.gst_tax_percentage / 100,
        "shipment-id": shipmentId,
        gift: item?.article_json?.is_gift ?? false,
        // "custom-attributes": {
        //   "custom-attribute": [],
        // },
      });
      prdLinPosition++;
    });
  });

  return prdListItems;
};

const getShipments = (data, orderData) => {
  const order = data?.payload.order;
  const shipListItems = [];
  let prdLinPosition = 1;
  order.shipments.forEach((shipment) => {
    // Shipment level
    const shipmentId = shipment?.id;
    const shipmentLvlInfoFromApi = orderData.shipments.find(
      (e) => e.shipment_id == shipmentId
    );
    const priceEffective = shipmentLvlInfoFromApi.prices?.price_effective ?? 0;
    const valueOfGood = shipmentLvlInfoFromApi.prices?.value_of_good ?? 0;
    const adjustedMerchTax =
      Math.floor((priceEffective - valueOfGood) * 100) / 100;

    shipListItems.push({
      "@attr": {
        "shipment-id": shipmentId
      },
      status: {
        "shipping-status": "NOT_SHIPPED",
      },
      "shipping-method": 1,
      "shipping-address": {
        "first-name": shipment.delivery_address_json.name,
        "last-name": "",
        address1: shipment.delivery_address_json.address1,
        city: shipment.delivery_address_json.city,
        "country-code": shipment.delivery_address_json.country_iso_code,
        phone: `${
          shipment.delivery_address_json.country_code +
          " " +
          shipment.delivery_address_json.phone
        }`,
        // "custom-attributes": {
        //   "custom-attribute": [],
        // },
      },
      gift: false,
      totals: {
        "merchandize-total": {
          "net-price": shipmentLvlInfoFromApi.prices.price_effective,
          tax: adjustedMerchTax,
          "gross-price": shipmentLvlInfoFromApi.prices.price_effective,
        },
        "adjusted-merchandize-total": {
          "net-price": shipmentLvlInfoFromApi.prices.price_effective,
          tax: adjustedMerchTax,
          "gross-price": shipmentLvlInfoFromApi.prices.price_effective,
        },
        "shipping-total": {
          "net-price": shipmentLvlInfoFromApi.prices.delivery_charge,
          tax: 0,
          "gross-price": shipmentLvlInfoFromApi.prices.delivery_charge,
        },
        "adjusted-shipping-total": {
          "net-price": shipmentLvlInfoFromApi.prices.delivery_charge,
          tax: 0,
          "gross-price": shipmentLvlInfoFromApi.prices.delivery_charge,
        },
        "shipment-total": {
          "net-price":
            shipmentLvlInfoFromApi.prices.price_effective +
            shipmentLvlInfoFromApi.prices.delivery_charge,
          tax: adjustedMerchTax,
          "gross-price":
            shipmentLvlInfoFromApi.prices.price_effective +
            shipmentLvlInfoFromApi.prices.delivery_charge,
        },
      },
    });
  });

  return shipListItems;
};

const getShipmentLineItemDetails = (data, orderData) => {
  const order = data?.payload.order;
  const shipmentListDetailItems = [];
  let prdLinPosition = 1;
  order.shipments.forEach((shipment) => {
    // Shipment level
    const shipmentId = shipment?.id;
    const shipmentLvlInfoFromApi = orderData.shipments.find(
      (e) => e.shipment_id == shipmentId
    );
    shipmentListDetailItems.push({
      "net-price": shipmentLvlInfoFromApi.prices.delivery_charge,
      tax: 0,
      "gross-price": shipmentLvlInfoFromApi.prices.delivery_charge,
      "base-price": shipmentLvlInfoFromApi.prices.delivery_charge,
      "lineitem-text": "Shipping",
      "tax-basis": 0,
      "item-id": "STANDARD_SHIPPING",
      "shipment-id": shipmentId,
      "tax-rate": 0,
    });
  });

  return shipmentListDetailItems;
};

const getTotalsOfOrder = (data, orderData, shipmentListMapped) => {
  const order = data?.payload.order;
  let totalMapped = {
    "merchandize-total": {
      "net-price": 0,
      tax: 0,
      "gross-price": 0,
      "price-adjustments": {
        "price-adjustment": [],
      },
    },
    "adjusted-merchandize-total": {
      "net-price": 0,
      tax: 0,
      "gross-price": 0,
    },
    "shipping-total": {
      "net-price": 0,
      tax: 0,
      "gross-price": 0,
    },
    "adjusted-shipping-total": {
      "net-price": 0,
      tax: 0,
      "gross-price": 0,
    },
    "order-total": {
      "net-price": 0,
      tax: 0,
      "gross-price": 0,
    },
  };
  shipmentListMapped.forEach((shipment) => {
    totalMapped["merchandize-total"] = {
      "net-price": getFloatFormatter(
        totalMapped["merchandize-total"]["net-price"] +
          shipment["totals"]["merchandize-total"]["net-price"]
      ),
      tax: getFloatFormatter(
        totalMapped["merchandize-total"]["tax"] +
          shipment.totals["merchandize-total"]["tax"]
      ),
      "gross-price": getFloatFormatter(
        totalMapped["merchandize-total"]["gross-price"] +
          shipment.totals["merchandize-total"]["gross-price"]
      ),
    };

    totalMapped["adjusted-merchandize-total"] = {
      "net-price": getFloatFormatter(
        totalMapped["adjusted-merchandize-total"]["net-price"] +
          shipment["totals"]["adjusted-merchandize-total"]["net-price"]
      ),
      tax: getFloatFormatter(
        totalMapped["adjusted-merchandize-total"]["tax"] +
          shipment["totals"]["adjusted-merchandize-total"]["tax"]
      ),
      "gross-price": getFloatFormatter(
        totalMapped["adjusted-merchandize-total"]["gross-price"] +
          shipment.totals["adjusted-merchandize-total"]["gross-price"]
      ),
    };

    totalMapped["shipping-total"] = {
      "net-price": getFloatFormatter(
        totalMapped["shipping-total"]["net-price"] +
          shipment["totals"]["shipping-total"]["net-price"]
      ),
      tax: getFloatFormatter(
        totalMapped["shipping-total"]["tax"] +
          shipment["totals"]["shipping-total"]["tax"]
      ),
      "gross-price": getFloatFormatter(
        totalMapped["shipping-total"]["gross-price"] +
          shipment["totals"]["shipping-total"]["gross-price"]
      ),
    };

    totalMapped["adjusted-shipping-total"] = {
      "net-price": getFloatFormatter(
        totalMapped["adjusted-shipping-total"]["net-price"] +
          shipment["totals"]["adjusted-shipping-total"]["net-price"]
      ),
      tax: getFloatFormatter(
        totalMapped["adjusted-shipping-total"]["tax"] +
          shipment["totals"]["adjusted-shipping-total"]["tax"]
      ),
      "gross-price": getFloatFormatter(
        totalMapped["adjusted-shipping-total"]["gross-price"] +
          shipment["totals"]["adjusted-shipping-total"]["gross-price"]
      ),
    };

    totalMapped["order-total"] = {
      "net-price": getFloatFormatter(
        totalMapped["adjusted-merchandize-total"]["net-price"] +
          totalMapped["shipping-total"]["net-price"]
      ),
      tax: getFloatFormatter(
        totalMapped["adjusted-merchandize-total"]["tax"] +
          totalMapped["shipping-total"]["tax"]
      ),
      "gross-price": getFloatFormatter(
        totalMapped["adjusted-merchandize-total"]["gross-price"] +
          totalMapped["shipping-total"]["gross-price"]
      ),
    };
  });

  return totalMapped;
};

const getFloatFormatter = (x) => {
  const formatted = Math.floor(x * 100) / 100;
  return formatted;
};

const getBillingAddress = (data) => {
  const event = data?.event;
  const order = data?.payload.order;
  const billAddr = order.shipments[0].billing_address_json;

  return {
    "first-name": billAddr.name,
    "last-name": "",
    address1: billAddr.address1,
    address2: billAddr.address2,
    city: billAddr.city,
    "country-code": billAddr.country_code,
    phone: billAddr.phone,
    // "custom-attributes": {
    //   "custom-attribute": [],
    // },
  };
};

const getStatus = (data) => {
  const order = data?.payload?.order;

  // TODO: create more mappings
  const paymentStatusMapper = {
    complete: "PAID",
  };
  const confirmationStatusMapper = {
    placed: "CONFIRMED",
  };

  return {
    "order-status": "NEW",
    "shipping-status": "NOT_SHIPPED",
    "confirmation-status": confirmationStatusMapper[order.status],
    "payment-status": paymentStatusMapper[order.meta.transaction_data.status],
  };
};

// TODO: complete this whole functiom
const getPaymentArray = (data, orderData) => {
  const order = data?.payload?.order;
  let payments = [];

  for (paymentTypeKey in order.payment_methods) {
    console.log("paymentTypeKey ====> ", paymentTypeKey);
    let obj = {
      "custom-method": {
        "method-name": order.payment_methods[paymentTypeKey].name,
      },
      amount: order.payment.price_breakup.order_value,
      "processor-id":
        order.payment_methods[paymentTypeKey].meta.payment_identifier,
      "transaction-id": order.payment_methods[paymentTypeKey].meta.payment_id,
      "transaction-type": "CAPTURE",
      // "custom-attributes": {
      //   "custom-attribute": [],
      // },
    };
    payments.push(obj);
  }

  return payments;
};

exports.xmlProcessor = async (jsonObj) => {
  // Convert JSON to XML
  var options = { compact: true, ignoreComment: true, spaces: 4 };
  var xml = xmljs.json2xml(jsonObj, options);
  xml = '<?xml version="1.0" encoding="UTF-8"?>\n' + xml;
  console.log("XML FORMAT TRANSFORMED ORDER", xml);

  // SEND TO S3 Bucket
  const params = {
    Bucket: process.env.SYNC_BUCKET_NAME,
    Key: `OrderExports/order_export_nice_fynd_${jsonObj["orders"]["order"][0]["original-order-no"]}.xml`,
    Body: xml,
    ContentType: "application/xml",
  };
  await s3.putObject(params).promise();
  console.log("Successfully uploaded file to S3 Bucket");
};

exports.authorisationToken = async () => {
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
    return {
      statusCode: error.response ? error.response.status : 500,
      body: JSON.stringify({
        message: error.message,
        error: error.response ? error.response.data : null,
      }),
    };
  }
};

exports.getOrderById = async (order_id, token) => {
  const orderUrl = `https://api.fynd.com/service/platform/orders/v1.0/company/7251/order-details?order_id=${order_id}`;
  const orderHeaders = {
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
  };
  try {
    const orderResponse = await axios.get(orderUrl, { headers: orderHeaders });
    return orderResponse.data;
  } catch (error) {
    return {
      statusCode: error.response ? error.response.status : 500,
      body: JSON.stringify({
        message: error.message,
        error: error.response ? error.response.data : null,
      }),
    };
  }
};
