const checkRole = require("../../src/middleware/role.middleware");

const createResponse = () => {
  const res = {
    status: vi.fn(() => res),
    json: vi.fn(() => res),
  };
  return res;
};

describe("role middleware", () => {
  it("allows configured roles and calls next exactly once", () => {
    const req = { user: { role: "ADMIN" } };
    const res = createResponse();
    const next = vi.fn();

    checkRole(["ADMIN", "MANAGER"])(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it("rejects forbidden roles with a controlled 403 response", () => {
    const req = { user: { role: "EXECUTIVE" } };
    const res = createResponse();
    const next = vi.fn();

    checkRole(["ADMIN", "MANAGER"])(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: "Access denied" });
  });

  it("rejects missing user context instead of granting access", () => {
    const req = { user: {} };
    const res = createResponse();
    const next = vi.fn();

    checkRole(["ADMIN"])(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
