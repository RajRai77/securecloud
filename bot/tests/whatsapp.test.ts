import crypto from "crypto";

// Set required env vars before importing config-dependent modules.
process.env.NEXTCLOUD_BOT_USERNAME = "test-bot";
process.env.NEXTCLOUD_BOT_APP_PASSWORD = "test-pass";
process.env.WHATSAPP_ACCESS_TOKEN = "test-token";
process.env.WHATSAPP_VERIFY_TOKEN = "test-verify";
process.env.WHATSAPP_APP_SECRET = "test-secret";
process.env.WHATSAPP_PHONE_NUMBER_ID = "12345";

import { verifyWebhookSignature } from "../src/integrations/whatsapp";

describe("verifyWebhookSignature", () => {
  const secret = "test-secret";

  function sign(body: Buffer): string {
    return "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex");
  }

  it("accepts a correctly signed payload", () => {
    const body = Buffer.from(JSON.stringify({ hello: "world" }));
    const sig = sign(body);
    expect(verifyWebhookSignature(body, sig)).toBe(true);
  });

  it("rejects a tampered payload", () => {
    const body = Buffer.from(JSON.stringify({ hello: "world" }));
    const sig = sign(body);
    const tampered = Buffer.from(JSON.stringify({ hello: "world!" }));
    expect(verifyWebhookSignature(tampered, sig)).toBe(false);
  });

  it("rejects a missing signature", () => {
    const body = Buffer.from("{}");
    expect(verifyWebhookSignature(body, undefined)).toBe(false);
  });

  it("rejects a malformed signature", () => {
    const body = Buffer.from("{}");
    expect(verifyWebhookSignature(body, "sha256=not-a-real-signature")).toBe(false);
  });
});
