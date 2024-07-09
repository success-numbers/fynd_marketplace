const cdk = require("aws-cdk-lib");
const { Stack } = require("aws-cdk-lib");
const lambda = require("aws-cdk-lib/aws-lambda");
const iam = require("aws-cdk-lib/aws-iam");
const apigw = require("aws-cdk-lib/aws-apigateway");
const sqs = require("aws-cdk-lib/aws-sqs");
const cognito = require("aws-cdk-lib/aws-cognito");
const logs = require("aws-cdk-lib/aws-logs");
const s3 = require("aws-cdk-lib/aws-s3");

class FyndMarketplaceBusinessStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    const { resourcePrefix, dbTables, attributes } = props;
    const masterApiGatewayName =
      resourcePrefix + attributes.masterApiGateway.masterGatewayName;
    const masterApiResourceId =
      resourcePrefix + attributes.masterApiGateway.exportResourceId;
    const masterApiExportId =
      resourcePrefix + attributes.masterApiGateway.exportApiId;

    // // const userPoolId = cdk.Fn.importValue(`${props.resourcePrefix}UserPoolId`);
    // const userPoolId = attributes.cognito.userPoolId;

    // const auth = new apigw.CognitoUserPoolsAuthorizer(this, resourcePrefix + 'bearer-token-authorizer', {
    //   cognitoUserPools: [cognito.UserPool.fromUserPoolId(this, resourcePrefix + 'UserPoolId', userPoolId)],
    //   identitySource: 'method.request.header.Authorization'
    // });

    // Import Lambda role using ARN
    const lambdaRole = iam.Role.fromRoleArn(
      this,
      "ImportedLambdaRole",
      `arn:aws:iam::${props.env.account}:role/${props.resourcePrefix}LambdaRole`,
      {
        mutable: false,
      }
    );

    const utilLayer = cdk.aws_lambda.LayerVersion.fromLayerVersionArn(
      this,
      `${props.resourcePrefix}${props.layersData.npmLayer.name}`,
      `arn:aws:lambda:${this.region}:${this.account}:layer:${props.resourcePrefix}${props.layersData.npmLayer.name}:${props.layersData.npmLayer.version}`
    );
    const allLayersList = [utilLayer];

    // S3 Bucket

    const bucket = new s3.Bucket(
      this,
      `${resourcePrefix}Fynd_Nice_OMS_Sync_Bucket`,
      {
        bucketName: `${resourcePrefix.toLowerCase()}-fynd-nice-sync-oms`,
        versioned: true, // Enable versioning
        removalPolicy: cdk.RemovalPolicy.DESTROY, // Automatically delete bucket when stack is deleted
        autoDeleteObjects: true, // Automatically delete objects in the bucket when the bucket is deleted
      }
    );

    // SQS
    //////////////////////////////////////////////////////////////////////

    const fyndOrderExportDLQ = new sqs.Queue(
      this,
      `${resourcePrefix}FYND_ORDER_EXPORT_DLQ`,
      {
        queueName: `${resourcePrefix}FYND_ORDER_EXPORT_DLQ`,
        visibilityTimeout: cdk.Duration.seconds(300),
      }
    );

    const fyndOrderExportSQS = new sqs.Queue(
      this,
      `${resourcePrefix}FYND_ORDER_EXPORT_Q`,
      {
        queueName: `${resourcePrefix}FYND_ORDER_EXPORT_Q`,
        visibilityTimeout: cdk.Duration.minutes(45),
        deadLetterQueue: {
          maxReceiveCount: 3,
          queue: fyndOrderExportDLQ,
        },
      }
    );

    const fyndOrderUpdatesDLQ = new sqs.Queue(
      this,
      `${resourcePrefix}FYND_ORDER_UPDATES_DLQ`,
      {
        queueName: `${resourcePrefix}FYND_ORDER_UPDATES_DLQ`,
        visibilityTimeout: cdk.Duration.seconds(300),
      }
    );

    const fyndOrderUpdatesSQS = new sqs.Queue(
      this,
      `${resourcePrefix}FYND_ORDER_UPDATES_Q`,
      {
        queueName: `${resourcePrefix}FYND_ORDER_UPDATES_Q`,
        visibilityTimeout: cdk.Duration.minutes(45),
        deadLetterQueue: {
          maxReceiveCount: 3,
          queue: fyndOrderUpdatesDLQ,
        },
      }
    );

    // LAMBDAS
    //////////////////////////////////////////////////////////////////////

    const fyndWebhookLambda = new lambda.Function(
      this,
      `${props.resourcePrefix}fyndWebhookLambda`,
      {
        runtime: props.runtime,
        layers: allLayersList,
        role: lambdaRole,
        functionName: `${props.resourcePrefix}fyndWebhookLambda`,
        code: lambda.Code.asset("lambdas/fyndWebhook"),
        handler: "fyndWebhookLambda.handler",
        environment: {
          fyndOrderExportSQS: `${fyndOrderExportSQS.queueUrl}`,
          fyndOrderUpdatesSQS: `${fyndOrderUpdatesSQS.queueUrl}`,
          REGION: props.env.region,
        },
      }
    );

    const fyndOMSOrderExportLambda = new lambda.Function(
      this,
      `${props.resourcePrefix}fyndOMSOrderExportLambda`,
      {
        description: "Lambda to process Fynd OMS orders export",
        runtime: props.runtime,
        layers: allLayersList,
        role: lambdaRole,
        functionName: `${props.resourcePrefix}fyndOMSOrderExportLambda`,
        code: lambda.Code.asset("lambdas/fyndOMSOrderExport"),
        handler: "fyndOMSOrderExportLambda.handler",
        timeout: cdk.Duration.minutes(15),
        logRetention: logs.RetentionDays.ONE_MONTH,
        reservedConcurrentExecutions: 1,
        memorySize: 256,
        environment: {
          REGION: props.env.region,
          SYNC_BUCKET_NAME: bucket.bucketName,
        },
      }
    );

    const fyndOMSOrderUpdatesLambda = new lambda.Function(
      this,
      `${props.resourcePrefix}fyndOMSOrderUpdatesLambda`,
      {
        description: "Lambda to process Fynd OMS Order Updates",
        runtime: props.runtime,
        layers: allLayersList,
        role: lambdaRole,
        functionName: `${props.resourcePrefix}fyndOMSOrderUpdatesLambda`,
        code: lambda.Code.asset("lambdas/fyndOMSOrderUpdates"),
        handler: "fyndOMSOrderUpdatesLambda.handler",
        timeout: cdk.Duration.minutes(15),
        logRetention: logs.RetentionDays.ONE_MONTH,
        reservedConcurrentExecutions: 1,
        memorySize: 256,
        environment: {
          REGION: props.env.region,
          SYNC_BUCKET_NAME: bucket.bucketName,
        },
      }
    );

    fyndOMSOrderExportLambda.addEventSource(
      new cdk.aws_lambda_event_sources.SqsEventSource(fyndOrderExportSQS, {
        batchSize: 1,
        enabled: true,
      })
    );

    fyndOMSOrderUpdatesLambda.addEventSource(
      new cdk.aws_lambda_event_sources.SqsEventSource(fyndOrderUpdatesSQS, {
        batchSize: 1,
        enabled: true,
      })
    );

    // API-GATEWAY
    //////////////////////////////////////////////////////////////////////

    const api = apigw.RestApi.fromRestApiAttributes(
      this,
      `${props.resourcePrefix}ApiGateway`,
      {
        restApiId: cdk.Fn.importValue(masterApiExportId),
        rootResourceId: cdk.Fn.importValue(masterApiResourceId),
      }
    );

    api.root.defaultCorsPreflightOptions = {
      allowHeaders: [
        "Content-Type",
        "X-Amz-Date",
        "Authorization",
        "Authorizer",
        "X-Api-Key",
      ],
      allowMethods: ["OPTIONS", "GET", "POST", "PUT", "PATCH", "DELETE"],
      allowCredentials: true,
      allowOrigins: props.allowCrossOrigins,
    };

    // api.root
    //     .resourceForPath("fileUpload/lov")
    //     .addMethod("GET", new apigw.LambdaIntegration(getLovLambda), {
    //         authorizer: auth,
    //         authorizationType: apigw.AuthorizationType.COGNITO,
    //     });

    // api.root
    //     .resourceForPath("fynd/order-export")
    //     .addMethod("POST", new apigw.LambdaIntegration(getDashboardDetailsLambda), {
    //         authorizer: auth,
    //         authorizationType: apigw.AuthorizationType.COGNITO,
    //     });

    api.root
      .resourceForPath("fynd/order-export")
      .addMethod("POST", new apigw.LambdaIntegration(fyndWebhookLambda));
  }
}

module.exports = { FyndMarketplaceBusinessStack };
