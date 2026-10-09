import { describe, expect, it } from "vitest";
import { cleanSub, isPushEndpoint, subscriberId } from "./push";

const keys = {
  p256dh:
    "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM",
  auth: "tBHItJI5svbpez7KI4CCXg",
};

describe("isPushEndpoint", () => {
  it("accepts the browsers' push services", () => {
    for (const e of [
      "https://fcm.googleapis.com/fcm/send/abc:def",
      "https://updates.push.services.mozilla.com/wpush/v2/gAAA",
      "https://web.push.apple.com/QOz7",
      "https://wns2-par02p.notify.windows.com/w/?token=x",
    ])
      expect(isPushEndpoint(e)).toBe(true);
  });

  it("refuses anything else", () => {
    for (const e of [
      "http://fcm.googleapis.com/fcm/send/x",
      "https://evil.com/fcm.googleapis.com",
      "https://fcm.googleapis.com.evil.com/x",
      "https://notpush.apple.com.example/x",
      "https://169.254.169.254/latest",
      "not a url",
    ])
      expect(isPushEndpoint(e)).toBe(false);
  });
});

describe("cleanSub", () => {
  it("keeps a browser's PushSubscription JSON", () => {
    const sub = {
      endpoint: "https://fcm.googleapis.com/fcm/send/x",
      expirationTime: null,
      keys,
    };
    expect(cleanSub(sub)).toEqual({ endpoint: sub.endpoint, keys });
  });

  it("refuses malformed or foreign ones", () => {
    expect(cleanSub(null)).toBeNull();
    expect(cleanSub({ endpoint: "https://example.com/push", keys })).toBeNull();
    expect(
      cleanSub({
        endpoint: "https://fcm.googleapis.com/x",
        keys: { p256dh: "a b", auth: "c" },
      }),
    ).toBeNull();
    expect(cleanSub({ endpoint: "https://fcm.googleapis.com/x" })).toBeNull();
  });
});

describe("subscriberId", () => {
  it("is stable and short", () => {
    const id = subscriberId("https://fcm.googleapis.com/fcm/send/x");
    expect(id).toBe(subscriberId("https://fcm.googleapis.com/fcm/send/x"));
    expect(id).not.toBe(subscriberId("https://fcm.googleapis.com/fcm/send/y"));
    expect(id).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });
});
