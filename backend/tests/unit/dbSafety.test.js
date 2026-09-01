const { assertSafeTestMongoUri } = require("../helpers/db");

describe("test MongoDB safety", () => {
  it("accepts local test database names", () => {
    expect(() =>
      assertSafeTestMongoUri("mongodb://127.0.0.1:27017/samvid_os_test"),
    ).not.toThrow();
    expect(() =>
      assertSafeTestMongoUri("mongodb://localhost:27017/samvid-os-integration"),
    ).not.toThrow();
  });

  it("rejects non-test database names", () => {
    expect(() =>
      assertSafeTestMongoUri("mongodb://127.0.0.1:27017/samvid_os"),
    ).toThrow(/non-test Mongo database/);
    expect(() =>
      assertSafeTestMongoUri("mongodb://127.0.0.1:27017/"),
    ).toThrow(/non-test Mongo database/);
  });

  it("rejects non-local hosts", () => {
    expect(() =>
      assertSafeTestMongoUri("mongodb://200.97.161.125:27017/samvid_os_test"),
    ).toThrow(/non-local Mongo host/);
    expect(() =>
      assertSafeTestMongoUri("mongodb://127.0.0.1:27017,example.com:27017/samvid_os_test"),
    ).toThrow(/non-local Mongo host/);
  });
});
