import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import api, { setUnauthorizedHandler } from "./api";
import { sessionStorage } from "../storage/sessionStorage";
import { makeUser } from "../test/fixtures";

describe("mobile API interceptors", () => {
  let apiMock: MockAdapter;
  let rootMock: MockAdapter;

  beforeEach(async () => {
    apiMock = new MockAdapter(api);
    rootMock = new MockAdapter(axios);
    await sessionStorage.clearSession();
    setUnauthorizedHandler(null);
  });

  afterEach(() => {
    apiMock.restore();
    rootMock.restore();
  });

  it("attaches stored bearer tokens to outgoing requests", async () => {
    await sessionStorage.setSession("access-token", makeUser("ADMIN"), "refresh-token");
    apiMock.onGet("/leads").reply((config) => [200, { authorization: config.headers?.Authorization }]);

    const response = await api.get("/leads");

    expect(response.data.authorization).toBe("Bearer access-token");
  });

  it("rotates refresh tokens once for simultaneous 401 responses", async () => {
    const user = makeUser("INSIDE_EXECUTIVE");
    let releaseRefresh: () => void = () => undefined;
    const refreshGate = new Promise<void>((resolve) => {
      releaseRefresh = resolve;
    });
    let refreshCalls = 0;
    await sessionStorage.setSession("old-access", user, "refresh-token");

    rootMock.onPost(/\/auth\/refresh$/).reply(
      async () => {
        refreshCalls += 1;
        await refreshGate;
        return [
          200,
          {
            accessToken: "new-access",
            refreshToken: "rotated-refresh",
            user,
          },
        ];
      },
    );

    apiMock.onGet("/leads").replyOnce(401);
    apiMock.onGet("/inventory").replyOnce(401);
    apiMock.onGet("/leads").reply((config) => [200, { authorization: config.headers?.Authorization }]);
    apiMock.onGet("/inventory").reply((config) => [200, { authorization: config.headers?.Authorization }]);

    const first = api.get("/leads");
    const second = api.get("/inventory");
    await new Promise((resolve) => setTimeout(resolve, 0));
    releaseRefresh();
    const [firstResponse, secondResponse] = await Promise.all([first, second]);

    expect(refreshCalls).toBe(1);
    expect(firstResponse.data.authorization).toBe("Bearer new-access");
    expect(secondResponse.data.authorization).toBe("Bearer new-access");
    expect(await sessionStorage.getToken()).toBe("new-access");
    expect(await sessionStorage.getRefreshToken()).toBe("rotated-refresh");
  });

  it("clears session and notifies AuthContext when refresh is unavailable", async () => {
    const unauthorizedHandler = jest.fn();
    await sessionStorage.setSession("old-access", makeUser("ADMIN"));
    setUnauthorizedHandler(unauthorizedHandler);
    apiMock.onGet("/auth/me").replyOnce(401);

    await expect(api.get("/auth/me")).rejects.toMatchObject({
      response: { status: 401 },
    });

    expect(await sessionStorage.getToken()).toBeNull();
    expect(unauthorizedHandler).toHaveBeenCalledTimes(1);
  });

  it("clears session when refresh token rotation fails", async () => {
    const unauthorizedHandler = jest.fn();
    await sessionStorage.setSession("old-access", makeUser("ADMIN"), "refresh-token");
    setUnauthorizedHandler(unauthorizedHandler);
    apiMock.onGet("/tasks").replyOnce(401);
    rootMock.onPost(/\/auth\/refresh$/).replyOnce(401, { message: "expired refresh" });

    await expect(api.get("/tasks")).rejects.toMatchObject({
      response: { status: 401 },
    });

    expect(await sessionStorage.getToken()).toBeNull();
    expect(unauthorizedHandler).toHaveBeenCalledTimes(1);
  });
});
