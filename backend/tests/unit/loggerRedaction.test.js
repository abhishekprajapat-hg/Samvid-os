const { Writable } = require("stream");
const pino = require("pino");
const { loggerOptions } = require("../../src/config/logger");

const createMemoryStream = () => {
  let output = "";
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      output += chunk.toString("utf8");
      callback();
    },
  });
  return {
    stream,
    output: () => output,
  };
};

describe("logger redaction", () => {
  it("redacts authorization, passwords and refresh tokens from structured logs", () => {
    const memory = createMemoryStream();
    const logger = pino(loggerOptions, memory.stream);

    logger.info({
      headers: { authorization: "Bearer header-secret" },
      password: "plain-password",
      token: "access-token-secret",
      refreshToken: "refresh-token-secret",
      req: {
        headers: { authorization: "Bearer request-secret" },
        body: {
          password: "body-password",
          refreshToken: "body-refresh-token",
        },
      },
    });

    const output = memory.output();
    expect(output).toContain("[REDACTED]");
    expect(output).not.toContain("header-secret");
    expect(output).not.toContain("plain-password");
    expect(output).not.toContain("access-token-secret");
    expect(output).not.toContain("refresh-token-secret");
    expect(output).not.toContain("request-secret");
    expect(output).not.toContain("body-password");
    expect(output).not.toContain("body-refresh-token");
  });
});
