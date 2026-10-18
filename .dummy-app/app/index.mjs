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

const srv = http.createServer((req, res) => {
  console.log(req.url);
  res.writeHead(204);
  res.end();
});
srv.listen(port, hostname);
