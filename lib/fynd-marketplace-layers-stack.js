const { Stack } = require('aws-cdk-lib');
const Lambda = require('aws-cdk-lib/aws-lambda');
const cdk = require('aws-cdk-lib');

class FyndMarketplaceLayersStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

  //////////////////////////////////////////// LAMBDA LAYER //////////////////////////////////////////////////////
  const { resourcePrefix, layersData } = props;
  const npmLayerName = layersData.npmLayer.name;
  // Util Layer
  new Lambda.LayerVersion(this,`${resourcePrefix}${npmLayerName}`,{
    code: Lambda.Code.fromAsset('layers/fynd-marketplace-package-layer'),
    compatibleRuntimes: [Lambda.Runtime.NODEJS_18_X],
    description: 'Lambda Layer for NPM Packages/tools',
    layerVersionName: `${resourcePrefix}${npmLayerName}`,
    compatibleArchitectures: [Lambda.Architecture.X86_64],
    removalPolicy: cdk.RemovalPolicy.RETAIN, // Set the removal policy to destroy the layer
  })
  }
}

module.exports = { FyndMarketplaceLayersStack };
