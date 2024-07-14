const AWS = require("aws-sdk");
const axios = require("axios");
const xmljs = require("xml-js");
const s3 = new AWS.S3();

exports.orderCancellation = (orderPayload, orderData) => {
  let data = getOrder(orderPayload, orderData);
  let ordersData = [
    {
      _attributes: {
        "order-no": data["original-order-no"],
      },
      ...data,
    },
  ];
  const finalPayload = {
    orders: {
      order: ordersData,
    },
  };
  console.log(finalPayload);

  return finalPayload;
};

const getOrder = (data, orderData) => {
  const event = data?.event;
  const order = orderData?.order;
  const shipmentListMapped = getShipments(data, orderData);
  const orderDate = new Date(event?.created_timestamp);
  const allShipmentUtilMapList = getFullShipments(data, orderData);
  return {
    "order-date": orderDate.toISOString(),
    "created-by": "storefront",
    "original-order-no": orderData.order.fynd_order_id,
    "currency": orderData.order.meta.currency.currency_code,
    "customer-locale": "ar-SA", // TODO
    "taxation": "gross",
    "invoice-no": orderData.order.fynd_order_id, // REAL INVOICE NO
    "customer": getCustomer(data, orderData),
    "status": getStatus(data, orderData),
    "channel-type": order.meta.order_platform,
    "current-order-no": order.fynd_order_id,
    "product-lineitems": {
      "product-lineitem": getProductLineItems(data, orderData),
    },
    "shipping-lineitems": {
      "shipping-lineitem": getShipmentLineItemDetails(data, orderData),
    },
    shipments: {
      shipment: shipmentListMapped,
    },
    totals: getTotalsOfOrder(data, orderData, allShipmentUtilMapList),
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


const getProductLineItems = (data, orderData) => {
  const cancelledShipment = data?.payload.shipment;
  const prdListItems = [];
  let prdLinPosition = 1;
  // Shipment level
  const shipmentId = cancelledShipment?.shipment_id;
  const shipmentLvlInfoFromApi = orderData.shipments.find(
    (e) => e.shipment_id == shipmentId
  );
  console.log(
    "MEOW getProductLineItems ===> shipmentLvlInfoFromApi",
    JSON.stringify(shipmentLvlInfoFromApi)
  );
  cancelledShipment.bags.forEach((item) => {
    // Get data from API if Required
    // const itemDataFromApi = shipmentLvlInfoFromApi.bags.find(
    //   (e) =>
    //     e.article.identifiers.ean == item.article_json.identifier.ean &&
    //     e.item.id == item.article_json.item_id
    // );
    const financialBreakup = item.financial_breakup[0];
    prdListItems.push({
      "net-price": financialBreakup.value_of_good,
      tax: financialBreakup.gst_fee,
      "gross-price": financialBreakup.price_effective,
      "base-price": financialBreakup.price_effective,
      "lineitem-text": `${item.item?.attributes.name}`,
      "tax-basis": financialBreakup.price_effective,
      position: prdLinPosition,
      "product-id": item.item?.id,
      "product-name": `${item.item?.attributes.name}`,
      quantity: item?.item?.quantity,
      "tax-rate": financialBreakup.gst_tax_percentage / 100,
      "shipment-id": shipmentId,
      gift: false,
      // "custom-attributes": {
      //   "custom-attribute": [],
      // },
    });
    prdLinPosition++;
  });

  return prdListItems;
};

const getCustomer = (data, orderData) => {
    const shipment = orderData.shipments[0];
    let isguest = shipment.user.is_anonymous_user ? true : false;
    let customer = {
      guest: isguest,
    };

    const billAddr = shipment.billing_details;
    customer = {
      ...customer,
      // "customer-no": 433922, // TODO
      "customer-name": billAddr["name"],
      "customer-email": billAddr?.email ?? "",
      "billing-address": getBillingAddress(orderData),
    };
    return customer;
  };

const getShipments = (data, orderData) => {
  const order = orderData?.order;
  const shipListItems = [];
  let prdLinPosition = 1;
  const cancelledShipment = data.payload.shipment;
  // Shipment level
  const shipmentId = cancelledShipment?.shipment_id;
  const shipmentLvlInfoFromApi = orderData.shipments.find(
    (e) => e.shipment_id == shipmentId
  );
  const priceEffective = cancelledShipment.prices?.price_effective ?? 0;
  const valueOfGood = cancelledShipment.prices?.value_of_good ?? 0;
  const adjustedMerchTax =
    Math.floor((priceEffective - valueOfGood) * 100) / 100;

  shipListItems.push({
    _attributes: {
      "shipment-id": shipmentId,
    },
    status: {
      "shipping-status": "NOT_SHIPPED",
    },
    "shipping-method": 1,
    "shipping-address": {
      "first-name": cancelledShipment.delivery_address.name,
      "last-name": "",
      address1: cancelledShipment.delivery_address.address1,
      city: cancelledShipment.delivery_address.city,
      "country-code": cancelledShipment.delivery_address.country_iso_code,
      phone: `${
        cancelledShipment.delivery_address.country_code +
        " " +
        cancelledShipment.delivery_address.phone
      }`,
      // "custom-attributes": {
      //   "custom-attribute": [],
      // },
    },
    gift: false,
    totals: {
      "merchandize-total": {
        "net-price": cancelledShipment.prices.price_effective,
        tax: adjustedMerchTax,
        "gross-price": cancelledShipment.prices.price_effective,
      },
      "adjusted-merchandize-total": {
        "net-price": cancelledShipment.prices.price_effective,
        tax: adjustedMerchTax,
        "gross-price": cancelledShipment.prices.price_effective,
      },
      "shipping-total": {
        "net-price": cancelledShipment.prices.delivery_charge,
        tax: 0,
        "gross-price": cancelledShipment.prices.delivery_charge,
      },
      "adjusted-shipping-total": {
        "net-price": cancelledShipment.prices.delivery_charge,
        tax: 0,
        "gross-price": cancelledShipment.prices.delivery_charge,
      },
      "shipment-total": {
        "net-price":
        cancelledShipment.prices.price_effective +
        cancelledShipment.prices.delivery_charge,
        tax: adjustedMerchTax,
        "gross-price":
        cancelledShipment.prices.price_effective +
        cancelledShipment.prices.delivery_charge,
      },
    },
  });
  return shipListItems;
};

const getFullShipments = (data, orderData) => {
  const order = orderData?.order;
  const allShipments = orderData.shipments;
  const shipListItems = [];
  let prdLinPosition = 1;
  allShipments.forEach((shipment) => {
    // Shipment level
    const shipmentId = shipment?.shipment_id;
    // const shipmentLvlInfoFromApi = orderData.shipments.find(
    //   (e) => e.shipment_id == shipmentId
    // );
    const priceEffective = shipment.prices?.price_effective ?? 0;
    const valueOfGood = shipment.prices?.value_of_good ?? 0;
    const adjustedMerchTax =
      Math.floor((priceEffective - valueOfGood) * 100) / 100;

    shipListItems.push({
      _attributes: {
        'shipment-id': shipmentId
      },
      status: {
        "shipping-status": "NOT_SHIPPED",
      },
      "shipping-method": 1,
      "shipping-address": {
        "first-name": shipment.delivery_details.name,
        "last-name": "",
        address1: shipment.delivery_details.address1,
        city: shipment.delivery_details.city,
        "country-code": shipment.delivery_details.country_iso_code,
        phone: `${
          shipment.delivery_details.country_code +
          " " +
          shipment.delivery_details.phone
        }`,
        // "custom-attributes": {
        //   "custom-attribute": [],
        // },
      },
      gift: false,
      totals: {
        "merchandize-total": {
          "net-price": shipment.prices.price_effective,
          tax: adjustedMerchTax,
          "gross-price": shipment.prices.price_effective,
        },
        "adjusted-merchandize-total": {
          "net-price": shipment.prices.price_effective,
          tax: adjustedMerchTax,
          "gross-price": shipment.prices.price_effective,
        },
        "shipping-total": {
          "net-price": shipment.prices.delivery_charge,
          tax: 0,
          "gross-price": shipment.prices.delivery_charge,
        },
        "adjusted-shipping-total": {
          "net-price": shipment.prices.delivery_charge,
          tax: 0,
          "gross-price": shipment.prices.delivery_charge,
        },
        "shipment-total": {
          "net-price":
          shipment.prices.price_effective +
          shipment.prices.delivery_charge,
          tax: adjustedMerchTax,
          "gross-price":
          shipment.prices.price_effective +
          shipment.prices.delivery_charge,
        },
      },
    });
  });

  return shipListItems;
};

const getShipmentLineItemDetails = (data, orderData) => {
  const order = orderData?.order;
  const shipmentListDetailItems = [];
  let prdLinPosition = 1;
  const cancelledShipment = data.payload.shipment;
  // Shipment level
  const shipmentId = cancelledShipment?.shipment_id;
  const shipmentLvlInfoFromApi = orderData.shipments.find(
    (e) => e.shipment_id == shipmentId
  );
  shipmentListDetailItems.push({
    "net-price": cancelledShipment.prices.delivery_charge,
    tax: 0,
    "gross-price": cancelledShipment.prices.delivery_charge,
    "base-price": cancelledShipment.prices.delivery_charge,
    "lineitem-text": "Shipping",
    "tax-basis": 0,
    "item-id": "STANDARD_SHIPPING",
    "shipment-id": shipmentId,
    "tax-rate": 0,
  });

  return shipmentListDetailItems;
};

const getTotalsOfOrder = (data, orderData, shipmentListMapped) => {
  const order = orderData?.order;
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

const getFirstAndLastName = (data) => {
  data = data.trim();
  const parts = data.split(" ");

  let firstName = "";
  let lastName = "";

  if (parts.length === 1) {
    firstName = parts[0];
    lastName = "";
  } else if (parts.length === 2) {
    firstName = parts[0];
    lastName = parts[1];
  } else {
    firstName = parts.slice(0, parts.length - 1).join(" ");
    lastName = parts[parts.length - 1];
  }

  return { firstName, lastName };
};

const getBillingAddress = (data) => {
  const billAddr = data.shipments[0].billing_details;
  const { firstName, lastName } = getFirstAndLastName(billAddr.name);

  return {
    "first-name": firstName,
    "last-name": lastName,
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

const getStatus = (data, orderData) => {
  const order = orderData?.order;
  const shipmentStatus = data?.payload?.shipment.status;
  // TODO: create more mappings
  const paymentStatusMapper = {
    complete: "PAID",
  };
  const confirmationStatusMapper = {
    placed: "CONFIRMED",
    cancelled_fynd: "CANCELLED"
  };

  return {
    "order-status": confirmationStatusMapper[shipmentStatus],
    "shipping-status": "NOT_SHIPPED",
    "confirmation-status": "CONFIRMED",
    "payment-status": paymentStatusMapper[order.meta.transaction_data.status],
  };
};

// TODO: complete this whole functiom
const getPaymentArray = (data, orderData) => {
  const order = orderData?.order;
  let payments = [];

  for (paymentTypeKey in order.payment_methods) {
    console.log("paymentTypeKey ====> ", paymentTypeKey);
    let obj = {
      "custom-method": {
        "method-name": order.payment_methods[paymentTypeKey].name,
      },
      amount: order.payment_methods[paymentTypeKey].amount,
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
