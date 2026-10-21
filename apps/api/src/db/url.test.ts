import { describe, expect, it } from "vitest";
import { writeTarget } from "./url.ts";

const pooled = "postgres://app:s3cret-pw@ep-xyz-pooler.ap-southeast-1.aws.neon.tech/neondb";
const direct = "postgres://app:s3cret-pw@ep-xyz.ap-southeast-1.aws.neon.tech/neondb";

describe("writeTarget", () => {
  it("prefers DATABASE_URL_UNPOOLED", () => {
    const target = writeTarget("migrate", {
      DATABASE_URL: pooled,
      DATABASE_URL_UNPOOLED: direct,
      VERCEL_ENV: "preview",
    });

    expect(target.url).toBe(direct);
    expect(target.logLine).toBe("migrate: env=preview host=ep-xyz.ap-southeast-1.aws.neon.tech");
  });

  it("falls back to DATABASE_URL, and says local off Vercel", () => {
    const target = writeTarget("seed", {
      DATABASE_URL: "postgres://magkano:magkano@localhost:5435/magkano",
    });

    expect(target.url).toBe("postgres://magkano:magkano@localhost:5435/magkano");
    expect(target.logLine).toBe("seed: env=local host=localhost");
  });

  it("fails clearly when neither URL is set, treating empty as unset", () => {
    expect(() => writeTarget("seed", {})).toThrow(
      "seed: neither DATABASE_URL_UNPOOLED nor DATABASE_URL is set (see .env.example)",
    );
    expect(() => writeTarget("migrate", { DATABASE_URL: "", DATABASE_URL_UNPOOLED: "" })).toThrow(
      "migrate: neither DATABASE_URL_UNPOOLED nor DATABASE_URL is set",
    );
  });

  it("never puts the password in the log line or a parse error", () => {
    const target = writeTarget("migrate", { DATABASE_URL: pooled, VERCEL_ENV: "production" });

    expect(target.logLine).toBe(
      "migrate: env=production host=ep-xyz-pooler.ap-southeast-1.aws.neon.tech",
    );
    expect(target.logLine).not.toContain("s3cret-pw");
    expect(() => writeTarget("seed", { DATABASE_URL: "s3cret-pw not a url" })).toThrow(
      /^seed: the database URL is not a valid URL$/,
    );
  });
});
