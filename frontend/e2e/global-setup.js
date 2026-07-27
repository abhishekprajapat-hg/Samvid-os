import fs from "node:fs";
import path from "node:path";
import { ROLES, roleUsers, tenant } from "./fixtures/seedData.js";

const authDir = path.resolve("e2e/.auth");

export default async function globalSetup() {
  fs.mkdirSync(authDir, { recursive: true });

  for (const role of ROLES) {
    const user = roleUsers[role];
    const storageState = {
      cookies: [],
      origins: [
        {
          origin: "http://127.0.0.1:4173",
          localStorage: [
            { name: "token", value: `token-${role}` },
            { name: "refreshToken", value: `refresh-${role}` },
            { name: "role", value: role },
            { name: "user", value: JSON.stringify(user) },
            ...(role === "SUPER_ADMIN" ? [] : [{ name: "tenant", value: JSON.stringify(tenant) }]),
          ],
        },
      ],
    };
    fs.writeFileSync(path.join(authDir, `${role}.json`), JSON.stringify(storageState, null, 2));
  }
}
