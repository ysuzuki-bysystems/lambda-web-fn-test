#!/usr/bin/env bun

import * as cdk from "aws-cdk-lib/core";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3n from "aws-cdk-lib/aws-s3-notifications";
import * as s3d from "aws-cdk-lib/aws-s3-deployment";
import * as lambdan from "aws-cdk-lib/aws-lambda-nodejs";
import * as cr from "aws-cdk-lib/custom-resources";

const app = new cdk.App();
const stack = new cdk.Stack(app, "LambdaWebFnTest", {
  env: {
    account: process.env["CDK_DEFAULT_ACCOUNT"],
    region: process.env["CDK_DEFAULT_REGION"],
  },
  tags: {
    Owner: "ysuzuki",
  },
});

const bucket = new s3.Bucket(stack, "Bucket", {
  removalPolicy: cdk.RemovalPolicy.DESTROY,
  autoDeleteObjects: true,
  versioned: true,
});
bucket.addToResourcePolicy(new iam.PolicyStatement({
  principals: [new iam.ServicePrincipal("lambda")],
  actions: [
    "s3:GetObject",
    "s3:GetObjectVersion",
  ],
  resources: [
    bucket.arnForObjects("*"),
  ],
  // TODO condition
}));

new s3d.BucketDeployment(stack, "InitialCodeDeploy", {
  sources: [
    // ./.dummy-app/out/app.zip ... 初回デプロイ用のダミーのコードが格納された .zip
    // もしかしたら、空zip でも良いかも
    s3d.Source.asset("./.dummy-app/out/"),
  ],
  destinationBucket: bucket,
});

const executionRole = new iam.Role(stack, "ExecutionRole", {
  assumedBy: new iam.ServicePrincipal("lambda"),
  managedPolicies: [
    iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole"),
  ],
});

// 初回デプロイ時のみ autoDeploymentMode: "LatestRevision" で lambda-web:CreateWebFunction を呼び出す AWS::CustomResource
const webFunction = new cr.AwsCustomResource(stack, "WebFunction", {
  installLatestAwsSdk: true,
  onCreate: {
    service: "lambda-web",
    action: "CreateWebFunction",
    parameters: {
      functionName: "MyFunction",
      endpointConfig: {
        authType: "ApplicationManaged",
        endpointName: "MyFunctionEndpoint",
        endpointType: "HomeRegion",
        autoDeploymentMode: "LatestRevision",
      },
      revisionConfig: {
        buildConfig: {
          codeConfig: {
            s3Object: {
              bucket: bucket.bucketName,
              key: "app.zip",
            },
          },
          runtimeConfig: {
            runtime: "nodejs24.x",
          },
        },
        serviceConfig: {
          executionRoleArn: executionRole.roleArn,
          environmentVariables: {
            AWS_LAMBDA_NODEJS_ENTRYPOINT: "index.mjs",
          },
        },
      },
    },
    physicalResourceId: cr.PhysicalResourceId.fromResponse("functionName"),
  },
  onDelete: {
    service: "lambda-web",
    action: "DeleteWebFunction",
    parameters: {
      functionName: new cr.PhysicalResourceIdReference(),
    },
  },
  policy: cr.AwsCustomResourcePolicy.fromStatements([
    new iam.PolicyStatement({
      actions: [
        "lambda:CreateWebFunction",
        "lambda:DeleteWebFunction",
      ],
      resources: [
        cdk.Arn.format({
          service: "lambda",
          resource: "web-function",
          resourceName: "MyFunction",
        }, stack),
      ],
    }),
    new iam.PolicyStatement({
      actions: [
        "iam:PassRole",
      ],
      resources: [
        executionRole.roleArn,
      ],
    }),
    new iam.PolicyStatement({
      actions: [
        "s3:GetObject",
        "s3:GetObjectVersion",
      ],
      resources: [
        bucket.arnForObjects("*"),
      ],
    }),
  ]),
});

// lambda-web:CreateWebFunctionRevision を呼び出す Lambda 関数
const updater = new lambdan.NodejsFunction(stack, "Updater", {
  entry: "./update.lambda.ts",
  handler: "handler",
  bundling: {
    bundleAwsSDK: true,
  },
  environment: {
    FUNCTION_NAME: webFunction.getResponseField("functionName"),
    BUCKET_NAME: bucket.bucketName,
    BUCKET_OBJECT_KEY: "app.zip",
    EXECUTION_ROLE_ARN: executionRole.roleArn,
  },
});
iam.Grant.addToPrincipal({
  grantee: updater,
  actions: [
    "lambda:CreateWebFunctionRevision",
  ],
  resourceArns: [
    webFunction.getResponseField("functionArn"),
  ],
});
iam.Grant.addToPrincipal({
  grantee: updater,
  actions: [
    "iam:PassRole",
  ],
  resourceArns: [
    executionRole.roleArn,
  ],
});
iam.Grant.addToPrincipal({
  grantee: updater,
  actions: [
    "s3:GetObject",
    "s3:GetObjectVersion",
  ],
  resourceArns: [
    bucket.arnForObjects("*"),
  ],
});

// バケットに配置でデプロイ(Updater) を実行
bucket.addObjectCreatedNotification(new s3n.LambdaDestination(updater));

new cdk.CfnOutput(stack, "EndpointUrl", {
  value: `https://${webFunction.getResponseField("endpoint.domainName")}`,
});

new cdk.CfnOutput(stack, "UpdaterName", {
  value: updater.functionName,
});
