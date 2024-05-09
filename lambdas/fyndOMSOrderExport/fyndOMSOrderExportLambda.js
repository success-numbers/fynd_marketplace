const AWS = require('aws-sdk');

exports.handler = async (event) => {
    try {
        console.log(event)
    } catch (e) {
        console.error('Error crud Lov:', e.toString());
    }
};
