const orderjson = require("./order-event.json");
const axios = require("axios");

export const orderTransformer = (orderPayload, orderData) => {
  let orders = {
    order: getOrder(orderPayload, orderData),
  };
  console.log(orders);
};

const getOrder = (data, orderData) => {
  const event = data?.event;
  const order = data?.payload.order;
  return {
    "order-date": event?.created_timestamp,
    "created-by": "storefront",
    "original-order-no": order.order_id,
    "currency": order.meta.currency.currency_code,
    "customer-locale": "ar-SA", // TODO
    taxation: "gross",
    "invoice-no": 531500, // TODO
    "customer": getCustomer(data),
    "status": getStatus(data),
    "channel-type": order.meta.order_platform,
    "current-order-no": order.order_id,
    "product-lineitems": {
      "product-lineitem": getProductLineItems(data, orderData),
    },
    "shipping-lineitems": {
      "shipping-lineitem": [], // NO mappings in Fynd because they dont have shipping charges fields of mno
    },
    "shipments": {
      "shipment": getShipments(data, orderData),
    },
    "totals": getTotalsOfOrder(data, orderData),
    "payments": {
      "payment": getPaymentArray(data),
    },

    notes: {
      note: [],
    },
    "custom-attributes": {
      // TODO
      "custom-attribute": [], // TODO
    },
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

  if (!isguest) {
    customer = {
      ...customer,
      "customer-no": 433922, // TODO
      "customer-name": "amani maash", // TODO
      "customer-email": "amanimaash@hotmail.com", // TODO
      "billing-address": getBillingAddress(data), // TODO
    };
  }

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

    shipment.bags.forEach((item) => {
      const itemDataFromApi = shipmentLvlInfoFromApi.bags.find(
        (e) =>
          e.item.article.identifiers.ean == item.article_json.identifier.ean &&
          e.item.id == item.article_json.item_id
      );
      prdListItems.push({
        "net-price": itemDataFromApi.financial_breakup.value_of_good,
        "tax": itemDataFromApi.financial_breakup.gst_fee,
        "gross-price": itemDataFromApi.financial_breakup.price_effective,
        "base-price": itemDataFromApi.financial_breakup.price_effective,
        "lineitem-text": `${item?.name}`,
        "tax-basis": itemDataFromApi.financial_breakup.price_effective,
        "position": prdLinPosition,
        "product-id": item?.id,
        "product-name": `${item?.name}`,
        "quantity": item?.quantity,
        "tax-rate": itemDataFromApi.financial_breakup.gst_tax_percentage / 100,
        "shipment-id": shipmentId,
        "gift": item?.article_json?.is_gift ?? false,
        "custom-attributes": {
          "custom-attribute": [],
        },
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
    shipListItems.push({
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
        "custom-attributes": {
          "custom-attribute": [],
        },
      },
      gift: false,
      totals: {
        "merchandize-total": {
          "net-price": shipmentLvlInfoFromApi.prices.value_of_good,
          tax: `${
            shipmentLvlInfoFromApi.prices.price_effective -
            shipmentLvlInfoFromApi.prices.value_of_good
          }`,
          "gross-price": shipmentLvlInfoFromApi.prices.price_effective,
        },
        "adjusted-merchandize-total": {
          "net-price": shipmentLvlInfoFromApi.prices.value_of_good,
          tax: `${
            shipmentLvlInfoFromApi.prices.price_effective -
            shipmentLvlInfoFromApi.prices.value_of_good
          }`,
          "gross-price": shipmentLvlInfoFromApi.prices.price_effective,
        },
        "shipping-total": {
          "net-price": 0, // THESE VALUES FOR SHIPPING NOT PRESENT IN FYND
          tax: 0,
          "gross-price": 0,
        },
        "adjusted-shipping-total": {
          "net-price": 0,
          tax: 0,
          "gross-price": 0,
        },
        "shipment-total": {
          "net-price": shipmentLvlInfoFromApi.prices.value_of_good,
          tax: `${
            shipmentLvlInfoFromApi.prices.price_effective -
            shipmentLvlInfoFromApi.prices.value_of_good
          }`,
          "gross-price": shipmentLvlInfoFromApi.prices.price_effective,
        },
      },
    });
  });

  return shipListItems;
};

const getTotalsOfOrder = (data, orderData) => {
    const order = data?.payload.order;
    let prdLinPosition = 1;
    order.shipments.forEach((shipment) => {
      // Shipment level
      const shipmentId = shipment?.id;
      const shipmentLvlInfoFromApi = orderData.shipments.find(
        (e) => e.shipment_id == shipmentId
      );
      
    });
  
    return shipListItems;
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
    "custom-attributes": {
      "custom-attribute": [],
    },
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
const getPaymentArray = (data) => {
  const order = data?.payload?.order;
  let payments = [];

  for (paymentTypeKey in order.payment_methods) {
    console.log("key == ", paymentTypeKey);
    let obj = {
      "credit-card": {
        "card-type": "Master Card",
        "card-number": "XXXX-XXXX-XXXX-2994",
        "expiration-month": 9,
        "expiration-year": 2024,
      },
      amount: 339.15,
      "processor-id": "CHECKOUTCOM_CARD",
      "transaction-id": "pay_gmafzrh7zltupcvtunkfpv75ye",
      "transaction-type": "CAPTURE",
      "custom-attributes": {
        "custom-attribute": ["act_qtxaszkr6u3utghesokv67rhvi", true, "Capture"],
      },
    };
    payments.push(obj);
  }

  return payments;
};

exports.xmlcreator = (jsonObj) => {};

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
    return {
      statusCode: 200,
      body: JSON.stringify(response.data?.access_token) ?? "",
    };
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

const axios = require("axios");

exports.getOrderById = async (order_id, token) => {
  const orderUrl = `https://api.fynd.com/service/platform/orders/v1.0/company/7251/order-details?order_id=${order_id}`;
  const orderHeaders = {
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
  };

  try {
    const orderResponse = await axios.get(orderUrl, { headers: orderHeaders });
    return {
      statusCode: 200,
      body: JSON.stringify(orderResponse.data),
    };
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

orderTransformer(orderjson);
