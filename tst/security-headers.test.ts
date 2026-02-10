import { describe, it, expect } from "vitest";
import {
  securityHeaders,
  ContentSecurityPolicy,
  REQUIRED_SECURITY_HEADERS,
  REQUIRED_CSP_DIRECTIVES,
  FORBIDDEN_CSP_VALUES,
  parseCSP,
} from "@/lib/security-headers";

describe("security-headers", () => {
  describe("required headers are present", () => {
    const headerKeys = securityHeaders.map((h) => h.key);

    it.each(REQUIRED_SECURITY_HEADERS)(
      "should include %s header",
      (headerName) => {
        expect(headerKeys).toContain(headerName);
      }
    );

    it("should have non-empty values for all headers", () => {
      for (const header of securityHeaders) {
        expect(header.value).toBeTruthy();
        expect(header.value.length).toBeGreaterThan(0);
      }
    });
  });

  describe("Content-Security-Policy", () => {
    const cspHeader = securityHeaders.find(
      (h) => h.key === "Content-Security-Policy"
    );
    const cspValue = cspHeader?.value ?? "";
    const parsedCSP = parseCSP(cspValue);

    it("should have a CSP header", () => {
      expect(cspHeader).toBeDefined();
    });

    it.each(REQUIRED_CSP_DIRECTIVES)(
      "should include %s directive",
      (directive) => {
        expect(parsedCSP.has(directive)).toBe(true);
      }
    );

    it("should set default-src to 'self'", () => {
      expect(parsedCSP.get("default-src")).toBe("'self'");
    });

    it("should block object embeds", () => {
      expect(parsedCSP.get("object-src")).toBe("'none'");
    });

    it("should prevent framing (clickjacking protection)", () => {
      expect(parsedCSP.get("frame-ancestors")).toBe("'none'");
    });

    it("should NOT include unsafe-eval in script-src", () => {
      const scriptSrc = parsedCSP.get("script-src") ?? "";
      expect(scriptSrc).not.toContain("'unsafe-eval'");
    });

    it("should NOT include data: in script-src", () => {
      const scriptSrc = parsedCSP.get("script-src") ?? "";
      expect(scriptSrc).not.toContain("data:");
    });

    it("should allow Google profile images in img-src", () => {
      const imgSrc = parsedCSP.get("img-src") ?? "";
      expect(imgSrc).toContain("https://lh3.googleusercontent.com");
    });

    it("should be properly formatted (no extra whitespace)", () => {
      expect(cspValue).not.toMatch(/\s{2,}/);
      expect(cspValue).not.toMatch(/^\s/);
      expect(cspValue).not.toMatch(/\s$/);
    });
  });

  describe("X-Frame-Options", () => {
    const header = securityHeaders.find((h) => h.key === "X-Frame-Options");

    it("should be set to DENY", () => {
      expect(header?.value).toBe("DENY");
    });
  });

  describe("X-Content-Type-Options", () => {
    const header = securityHeaders.find(
      (h) => h.key === "X-Content-Type-Options"
    );

    it("should be set to nosniff", () => {
      expect(header?.value).toBe("nosniff");
    });
  });

  describe("Strict-Transport-Security", () => {
    const header = securityHeaders.find(
      (h) => h.key === "Strict-Transport-Security"
    );

    it("should be present", () => {
      expect(header).toBeDefined();
    });

    it("should have max-age of at least 1 year", () => {
      const match = header?.value.match(/max-age=(\d+)/);
      expect(match).toBeTruthy();
      const maxAge = parseInt(match![1], 10);
      expect(maxAge).toBeGreaterThanOrEqual(31536000); // 1 year in seconds
    });

    it("should include subdomains", () => {
      expect(header?.value).toContain("includeSubDomains");
    });
  });

  describe("Referrer-Policy", () => {
    const header = securityHeaders.find((h) => h.key === "Referrer-Policy");

    it("should use strict-origin-when-cross-origin", () => {
      expect(header?.value).toBe("strict-origin-when-cross-origin");
    });
  });

  describe("Permissions-Policy", () => {
    const header = securityHeaders.find((h) => h.key === "Permissions-Policy");

    it("should disable camera", () => {
      expect(header?.value).toContain("camera=()");
    });

    it("should disable microphone", () => {
      expect(header?.value).toContain("microphone=()");
    });

    it("should disable geolocation", () => {
      expect(header?.value).toContain("geolocation=()");
    });
  });

  describe("Cross-Origin headers", () => {
    it("should set Cross-Origin-Opener-Policy to same-origin", () => {
      const header = securityHeaders.find(
        (h) => h.key === "Cross-Origin-Opener-Policy"
      );
      expect(header?.value).toBe("same-origin");
    });

    it("should set Cross-Origin-Resource-Policy to same-origin", () => {
      const header = securityHeaders.find(
        (h) => h.key === "Cross-Origin-Resource-Policy"
      );
      expect(header?.value).toBe("same-origin");
    });
  });

  describe("parseCSP utility", () => {
    it("should parse simple CSP", () => {
      const result = parseCSP("default-src 'self'; script-src 'none'");
      expect(result.get("default-src")).toBe("'self'");
      expect(result.get("script-src")).toBe("'none'");
    });

    it("should handle multiple values", () => {
      const result = parseCSP("img-src 'self' data: https://example.com");
      expect(result.get("img-src")).toBe("'self' data: https://example.com");
    });

    it("should handle empty input", () => {
      const result = parseCSP("");
      expect(result.size).toBe(0);
    });

    it("should trim whitespace", () => {
      const result = parseCSP("  default-src   'self'  ;  script-src 'none'  ");
      expect(result.get("default-src")).toBe("'self'");
      expect(result.get("script-src")).toBe("'none'");
    });
  });

  describe("forbidden values not present", () => {
    const cspHeader = securityHeaders.find(
      (h) => h.key === "Content-Security-Policy"
    );
    const scriptSrc =
      parseCSP(cspHeader?.value ?? "").get("script-src") ?? "";

    it.each(FORBIDDEN_CSP_VALUES)(
      "should NOT contain %s in script-src",
      (forbidden) => {
        expect(scriptSrc).not.toContain(forbidden);
      }
    );
  });
});
