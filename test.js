const Stream = require("stream");
const queryString = require("querystring");
const http = require("http");
const nextPage = require("./.next/serverless/pages/index");

const createRequestObject = ({ event }) => {
  const {
    requestContext = {},
    path = "",
    multiValueQueryStringParameters,
    pathParameters,
    httpMethod,
    multiValueHeaders = {},
    body,
    isBase64Encoded,
  } = event;

  const newStream = new Stream.Readable();
  const req = Object.assign(newStream, http.IncomingMessage.prototype);
  req.url =
    (requestContext.path || path || "").replace(
      new RegExp("^/" + requestContext.stage),
      ""
    ) || "/";

  let qs = "";

  if (multiValueQueryStringParameters) {
    qs += queryString.stringify(multiValueQueryStringParameters);
  }

  if (pathParameters) {
    const pathParametersQs = queryString.stringify(pathParameters);

    if (qs.length > 0) {
      qs += `&${pathParametersQs}`;
    } else {
      qs += pathParametersQs;
    }
  }

  const hasQueryString = qs.length > 0;

  if (hasQueryString) {
    req.url += `?${qs}`;
  }

  req.method = httpMethod;
  req.rawHeaders = [];
  req.headers = {};

  for (const key of Object.keys(multiValueHeaders)) {
    for (const value of multiValueHeaders[key]) {
      req.rawHeaders.push(key);
      req.rawHeaders.push(value);
    }
    req.headers[key.toLowerCase()] = multiValueHeaders[key].toString();
  }

  req.getHeader = (name) => {
    return req.headers[name.toLowerCase()];
  };
  req.getHeaders = () => {
    return req.headers;
  };

  req.connection = {};

  if (body) {
    req.push(body, isBase64Encoded ? "base64" : undefined);
  }

  req.push(null);

  return req;
};

const createResponseObject = ({ onResEnd }) => {
  const response = {
    isBase64Encoded: true,
    multiValueHeaders: {},
  };

  const res = new Stream();
  Object.defineProperty(res, "statusCode", {
    get() {
      return response.statusCode;
    },
    set(statusCode) {
      response.statusCode = statusCode;
    },
  });
  res.headers = {};
  res.writeHead = (status, headers) => {
    response.statusCode = status;
    if (headers) res.headers = Object.assign(res.headers, headers);

    // Return res object to allow for chaining
    // Fixes: https://github.com/netlify/next-on-netlify/pull/74
    return res;
  };
  res.write = (chunk) => {
    if (!response.body) {
      response.body = Buffer.from("");
    }

    response.body = Buffer.concat([
      Buffer.isBuffer(response.body)
        ? response.body
        : Buffer.from(response.body),
      Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk),
    ]);
  };
  res.setHeader = (name, value) => {
    res.headers[name.toLowerCase()] = value;
  };
  res.removeHeader = (name) => {
    delete res.headers[name.toLowerCase()];
  };
  res.getHeader = (name) => {
    return res.headers[name.toLowerCase()];
  };
  res.getHeaders = () => {
    return res.headers;
  };
  res.hasHeader = (name) => {
    return !!res.getHeader(name);
  };
  res.end = (text) => {
    if (text) res.write(text);
    if (!res.statusCode) {
      res.statusCode = 200;
    }

    if (response.body) {
      response.body = Buffer.from(response.body).toString("base64");
    }
    response.multiValueHeaders = res.headers;
    res.writeHead(response.statusCode);

    // Convert all multiValueHeaders into arrays
    for (const key of Object.keys(response.multiValueHeaders)) {
      if (!Array.isArray(response.multiValueHeaders[key])) {
        response.multiValueHeaders[key] = [response.multiValueHeaders[key]];
      }
    }

    // Call onResEnd handler with the response object
    onResEnd(response);
  };

  return res;
};

const main = async () => {
  const result = await new Promise((resolve) => {
    const req = createRequestObject({ event: { httpMethod: "GET" } });
    const res = createResponseObject({
      onResEnd: (response) => resolve(response),
    });

    nextPage.render(req, res);
  });

  console.log(result);
};

main().catch((err) => {
  console.log(err);
  process.exitCode = 1;
});
