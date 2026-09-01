declare const require: any;
declare const __dirname: string;

const fs = require("fs");
const path = require("path");
const appConfig = require("../../app.json");

const rootDir = path.resolve(__dirname, "..", "..");
const readFlow = (relativePath: string) =>
  fs.readFileSync(path.join(rootDir, relativePath), "utf8");

describe("Maestro mobile contracts", () => {
  const androidPackage = appConfig.expo.android.package;
  const iosBundleIdentifier = appConfig.expo.ios.bundleIdentifier;

  it("declares validated Android and iOS app IDs", () => {
    expect(androidPackage).toBe("com.samvidos.crm");
    expect(iosBundleIdentifier).toBe("com.samvidos.crm");
  });

  it("keeps Maestro app IDs aligned with app.json", () => {
    expect(readFlow("e2e/maestro/android/smoke.yaml")).toContain(`appId: ${androidPackage}`);
    expect(readFlow("e2e/maestro/android/business-smoke.yaml")).toContain(`appId: ${androidPackage}`);
    expect(readFlow("e2e/maestro/ios/smoke.yaml")).toContain(`appId: ${iosBundleIdentifier}`);
    expect(readFlow("e2e/maestro/ios/business-smoke.yaml")).toContain(`appId: ${iosBundleIdentifier}`);
  });

  it("does not hardcode login passwords in Maestro flows", () => {
    for (const flow of [
      "e2e/maestro/android/smoke.yaml",
      "e2e/maestro/android/business-smoke.yaml",
      "e2e/maestro/ios/smoke.yaml",
      "e2e/maestro/ios/business-smoke.yaml",
    ]) {
      const content = readFlow(flow);
      expect(content).toContain("${SAMVID_MOBILE_PASSWORD}");
      expect(content).not.toMatch(/inputText:\s*['"]?(password|secret|admin123|test123)/i);
    }
  });

  it("declares permissions required by active mobile workflows", () => {
    expect(appConfig.expo.android.permissions).toEqual(
      expect.arrayContaining([
        "CAMERA",
        "RECORD_AUDIO",
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION",
        "READ_MEDIA_IMAGES",
        "POST_NOTIFICATIONS",
      ]),
    );
    expect(appConfig.expo.ios.infoPlist).toEqual(
      expect.objectContaining({
        NSCameraUsageDescription: expect.any(String),
        NSMicrophoneUsageDescription: expect.any(String),
        NSPhotoLibraryUsageDescription: expect.any(String),
        NSLocationWhenInUseUsageDescription: expect.any(String),
        NSUserNotificationUsageDescription: expect.any(String),
      }),
    );
  });
});
