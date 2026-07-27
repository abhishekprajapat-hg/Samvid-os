const request = require("supertest");
const app = require("../../src/app");
const User = require("../../src/models/User");
const {
  authHeaderFor,
  createCompanyUsers,
} = require("../fixtures");

describe("user update route", () => {
  it("uses the canonical admin update handler for PATCH /users/:userId", async () => {
    const { admin, channelPartner } = await createCompanyUsers();

    const res = await request(app)
      .patch(`/api/users/${channelPartner._id}`)
      .set(authHeaderFor(admin))
      .send({
        name: "Updated Partner",
        canViewInventory: true,
        brokerageConfig: {
          mode: "PERCENTAGE",
          value: 2.5,
          notes: "Canonical handler field",
        },
      })
      .expect(200);

    expect(res.body.user.name).toBe("Updated Partner");
    expect(res.body.user.canViewInventory).toBe(true);
    expect(res.body.user.brokerageConfig).toMatchObject({
      mode: "PERCENTAGE",
      value: 2.5,
      notes: "Canonical handler field",
    });

    const updated = await User.findById(channelPartner._id).lean();
    expect(updated.brokerageConfig).toMatchObject({
      mode: "PERCENTAGE",
      value: 2.5,
      notes: "Canonical handler field",
    });
  });
});
