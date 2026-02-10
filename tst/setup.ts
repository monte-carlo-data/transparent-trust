import { beforeEach, vi } from "vitest";

// Set required environment variables for tests
process.env.NEXTAUTH_URL = "http://localhost:3000";
process.env.ANTHROPIC_API_KEY = "test-api-key";
(process.env as Record<string, string>).NODE_ENV = "test";

type PrismaMock = Record<string, unknown>;

const prismaMock: PrismaMock = {};
const getServerSession = vi.fn();
const requireAuth = vi.fn();
const logProjectChange = vi.fn();
const logDocumentChange = vi.fn();
const logContractChange = vi.fn();
const computeChanges = vi.fn();
const getUserFromSession = vi.fn();

function resetPrismaMock() {
  for (const key of Object.keys(prismaMock)) {
    delete prismaMock[key];
  }
}

globalThis.__testMocks = {
  prismaMock,
  resetPrismaMock,
  getServerSession,
  requireAuth,
  logProjectChange,
  logDocumentChange,
  logContractChange,
  computeChanges,
  getUserFromSession,
};

vi.mock("@/lib/prisma", () => ({
  __esModule: true,
  prisma: prismaMock,
  default: prismaMock,
}));

vi.mock("next-auth", () => ({
  getServerSession,
}));

vi.mock("@/lib/apiAuth", () => ({
  requireAuth,
}));

vi.mock("@/lib/auditLog", () => ({
  logProjectChange,
  logDocumentChange,
  logContractChange,
  computeChanges,
  getUserFromSession,
}));

beforeEach(() => {
  resetPrismaMock();
  computeChanges.mockReturnValue({});
  getUserFromSession.mockReturnValue({ id: "user1", email: "test@example.com" });
  requireAuth.mockResolvedValue({
    authorized: true,
    session: { user: { id: "user1", name: "Test", email: "test@example.com" } },
  });
  getServerSession.mockResolvedValue({ user: { id: "user-1", email: "user@example.com" } });
});
