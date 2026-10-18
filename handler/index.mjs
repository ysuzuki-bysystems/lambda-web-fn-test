import * as http from "node:http";

const [hostname, maybePort] = process.env["AWS_LAMBDA_HTTP_ENDPOINT"].split(":", 2);
if (typeof maybePort === "undefined" || typeof hostname === "undefined") {
  throw new Error(`Invalid ${process.env["AWS_LAMBDA_HTTP_ENDPOINT"]}`);
}
const port = Number.parseInt(maybePort, 10);
if (!Number.isFinite(port)) {
  throw new Error(`Invalid ${process.env["AWS_LAMBDA_HTTP_ENDPOINT"]}`);
}
console.log(port, hostname);

const srv = http.createServer((_req, res) => {
  res.write("ENV!!!\n");
  for (const [key, val] of Object.entries(process.env)) {
    if (key === "AWS_SECRET_ACCESS_KEY") {
      continue;
    }
    if (key === "AWS_SESSION_TOKEN") {
      continue;
    }
    if (key === "AWS_ACCESS_KEY_ID") {
      continue;
    }

    res.write(`${key}=${val}\n`);
  }
  res.end();
});
srv.listen(port, hostname);
