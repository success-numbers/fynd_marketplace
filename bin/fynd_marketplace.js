#!/usr/bin/env node

const cdk = require('aws-cdk-lib');

const { FyndMarketplaceCommonStack } = require('../lib/fynd-marketplace-common-stack');
// const { FyndMarketplaceDynamoDbStack } = require('../lib/fynd-marketplace-dynamodb-stack');
const { FyndMarketplaceBusinessStack } = require('../lib/fynd-marketplace-business-stack');
const { FyndMarketplaceLayersStack } = require('../lib/fynd-marketplace-layers-stack');

const app = new cdk.App();

let config = {};

if (app.node.tryGetContext("deploy-environment") === "sit") {
  config = app.node.tryGetContext("sit-config");
} else if (app.node.tryGetContext("deploy-environment") === "uat") {
  config = app.node.tryGetContext("uat-config");
} else if (app.node.tryGetContext("deploy-environment") === "prod") {
  config = app.node.tryGetContext("prod-config");
}

const projectResourcesPrefix =
config.project.projectName + "-" + config.project.projectEnvironment + "-";
const StackPrefix =
  config.project.projectName.toLowerCase() +
  "-" +
  config.project.projectEnvironment.toLowerCase() +
  "-";

cdk.Tags.of(app).add(config.tags.tagid, config.tags.tagval)

// new FyndMarketplaceCognitoStack(app, `${StackPrefix}cognito-stack`, {
//   resourcePrefix : projectResourcesPrefix
// });

new FyndMarketplaceLayersStack(app,`${StackPrefix}layers-stack`,{
  resourcePrefix : projectResourcesPrefix,
  layersData: config.layers,
  env: config.env
});

new FyndMarketplaceCommonStack(app,`${StackPrefix}common-stack`,{
  resourcePrefix : projectResourcesPrefix,
  env: config.env,
  attributes: config.attributes,
  roles: config.roles,
  allowCrossOrigins: config.allowCrossOrigins,
  deployConfig: config.deployConfig,
});

// new FyndMarketplaceDynamoDbStack(app, `${StackPrefix}dynamodb-stack`,{
//   resourcePrefix : projectResourcesPrefix,
//   env: config.env,
//   dbTables: config.dynamoDBTables,
//   attributes: config.attributes,
//   roles: config.roles,
//   allowCrossOrigins: config.allowCrossOrigins,
// });

new FyndMarketplaceBusinessStack(app, `${StackPrefix}buisness-stack`,{
  resourcePrefix : projectResourcesPrefix,
  env: config.env,
  attributes: config.attributes,
  roles: config.roles,
  dbTables: config.dynamoDBTables,
  allowCrossOrigins: config.allowCrossOrigins,
  layersData:config.layers,
  runtime: cdk.aws_lambda.Runtime.NODEJS_18_X,
});
