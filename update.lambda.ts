import type { Handler } from "aws-lambda";
import { LambdaWebClient, CreateWebFunctionRevisionCommand } from "@aws-sdk/client-lambda-web";

type Event = {
};

type Result = void;

function must(v: unknown): asserts v is string {
  if (typeof v !== "string") {
    throw new Error();
  }
}

const FUNCTION_NAME = process.env["FUNCTION_NAME"];
const BUCKET_NAME = process.env["BUCKET_NAME"];
const BUCKET_OBJECT_KEY = process.env["BUCKET_OBJECT_KEY"];
const EXECUTION_ROLE_ARN = process.env["EXECUTION_ROLE_ARN"];

must(FUNCTION_NAME);
must(BUCKET_NAME);
must(BUCKET_OBJECT_KEY);
must(EXECUTION_ROLE_ARN);

const client = new LambdaWebClient();

export async function handler() {
  await client.send(new CreateWebFunctionRevisionCommand({
    functionName: FUNCTION_NAME,
    buildConfig: {
      codeConfig: {
        s3Object: {
          bucket: BUCKET_NAME,
          key: BUCKET_OBJECT_KEY,
        },
      },
      runtimeConfig: {
        runtime: "nodejs24.x",
      },
    },
    serviceConfig: {
      executionRoleArn: EXECUTION_ROLE_ARN,
      environmentVariables: {
        AWS_LAMBDA_NODEJS_ENTRYPOINT: "index.mjs",
      },
    },
  }));
}

handler satisfies Handler<Event, Result>;
