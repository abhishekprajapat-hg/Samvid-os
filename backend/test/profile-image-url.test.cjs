const assert = require("node:assert/strict");
const test = require("node:test");
const { isAllowedProfileImageUrl } = require("../src/utils/profileImageUrl");

test("profile images accept the same-origin URL returned by the upload API", () => {
  assert.equal(
    isAllowedProfileImageUrl("/api/uploads/files/profile-images/1790869200000-a1b2c3d4e5f6.webp"),
    true,
  );
});

test("profile images retain support for external http and https URLs", () => {
  assert.equal(isAllowedProfileImageUrl("https://cdn.example.com/avatar.webp"), true);
  assert.equal(isAllowedProfileImageUrl("http://cdn.example.com/avatar.png"), true);
  assert.equal(isAllowedProfileImageUrl(""), true);
});

test("profile images reject unsafe relative paths and unsupported schemes", () => {
  assert.equal(isAllowedProfileImageUrl("/api/uploads/files/profile-images/../private.txt"), false);
  assert.equal(isAllowedProfileImageUrl("/api/uploads/files/chat/message.png"), false);
  assert.equal(isAllowedProfileImageUrl("//cdn.example.com/avatar.png"), false);
  assert.equal(isAllowedProfileImageUrl("data:image/png;base64,abc"), false);
});
