import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// We need to test the sanitization logic, so we'll import the module dynamically
// to control the NODE_ENV

describe("apiResponse", () => {
  describe("error sanitization in production", () => {
    beforeEach(() => {
      vi.stubEnv("NODE_ENV", "production");
      vi.resetModules();
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("should sanitize Prisma errors", async () => {
      const { errors } = await import("@/lib/apiResponse");
      const response = errors.internal("Prisma query failed: column not found");
      const body = await response.json();
      expect(body.error).toBe("Internal Server Error");
    });

    it("should sanitize database errors", async () => {
      const { errors } = await import("@/lib/apiResponse");
      const response = errors.internal("Database connection timeout");
      const body = await response.json();
      expect(body.error).toBe("Internal Server Error");
    });

    it("should sanitize SQL errors", async () => {
      const { errors } = await import("@/lib/apiResponse");
      const response = errors.internal("SQL syntax error near SELECT");
      const body = await response.json();
      expect(body.error).toBe("Internal Server Error");
    });

    it("should sanitize connection errors", async () => {
      const { errors } = await import("@/lib/apiResponse");
      const response = errors.badGateway("ECONNREFUSED 127.0.0.1:5432");
      const body = await response.json();
      expect(body.error).toBe("Bad Gateway");
    });

    it("should sanitize stack traces", async () => {
      const { errors } = await import("@/lib/apiResponse");
      const response = errors.internal("Error at processRequest (/src/lib/handler.ts:42)");
      const body = await response.json();
      expect(body.error).toBe("Internal Server Error");
    });

    it("should sanitize file paths", async () => {
      const { errors } = await import("@/lib/apiResponse");
      const response = errors.internal("Failed to read /src/config/secrets.ts:15");
      const body = await response.json();
      expect(body.error).toBe("Internal Server Error");
    });

    it("should sanitize token/credential mentions", async () => {
      const { errors } = await import("@/lib/apiResponse");
      const response = errors.unauthorized("Invalid API key provided");
      const body = await response.json();
      expect(body.error).toBe("Unauthorized");
    });

    it("should allow safe user-facing messages", async () => {
      const { errors } = await import("@/lib/apiResponse");
      const response = errors.badRequest("Email format is invalid");
      const body = await response.json();
      expect(body.error).toBe("Email format is invalid");
    });

    it("should allow safe not found messages", async () => {
      const { errors } = await import("@/lib/apiResponse");
      const response = errors.notFound("User not found");
      const body = await response.json();
      expect(body.error).toBe("User not found");
    });

    it("should allow safe validation messages", async () => {
      const { errors } = await import("@/lib/apiResponse");
      const response = errors.badRequest("Title must be at least 3 characters");
      const body = await response.json();
      expect(body.error).toBe("Title must be at least 3 characters");
    });
  });

  describe("error messages in development", () => {
    beforeEach(() => {
      vi.stubEnv("NODE_ENV", "development");
      vi.resetModules();
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("should show full error messages in development", async () => {
      const { errors } = await import("@/lib/apiResponse");
      const response = errors.internal("Prisma query failed: column 'userId' not found");
      const body = await response.json();
      expect(body.error).toBe("Prisma query failed: column 'userId' not found");
    });

    it("should show stack traces in development", async () => {
      const { errors } = await import("@/lib/apiResponse");
      const errorMsg = "Error at processRequest (/src/lib/handler.ts:42)";
      const response = errors.internal(errorMsg);
      const body = await response.json();
      expect(body.error).toBe(errorMsg);
    });
  });

  describe("HTTP status codes", () => {
    beforeEach(() => {
      vi.resetModules();
    });

    it("should return correct status codes", async () => {
      const { errors } = await import("@/lib/apiResponse");

      expect(errors.badRequest().status).toBe(400);
      expect(errors.unauthorized().status).toBe(401);
      expect(errors.forbidden().status).toBe(403);
      expect(errors.notFound().status).toBe(404);
      expect(errors.conflict().status).toBe(409);
      expect(errors.internal().status).toBe(500);
      expect(errors.badGateway().status).toBe(502);
    });
  });

  describe("apiSuccess", () => {
    it("should return JSON with default 200 status", async () => {
      const { apiSuccess } = await import("@/lib/apiResponse");
      const response = apiSuccess({ data: "test" });
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual({ data: "test" });
    });

    it("should support custom status codes", async () => {
      const { apiSuccess } = await import("@/lib/apiResponse");
      const response = apiSuccess({ created: true }, 201);
      expect(response.status).toBe(201);
    });
  });
});
