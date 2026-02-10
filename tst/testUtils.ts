type TestMocks = {
  prismaMock: Record<string, unknown>;
  resetPrismaMock: () => void;
  getServerSession: ReturnType<typeof import("vitest").vi.fn>;
  requireAuth: ReturnType<typeof import("vitest").vi.fn>;
  logProjectChange: ReturnType<typeof import("vitest").vi.fn>;
  logDocumentChange: ReturnType<typeof import("vitest").vi.fn>;
  logContractChange: ReturnType<typeof import("vitest").vi.fn>;
  computeChanges: ReturnType<typeof import("vitest").vi.fn>;
  getUserFromSession: ReturnType<typeof import("vitest").vi.fn>;
};

export function getTestMocks(): TestMocks {
  return globalThis.__testMocks as TestMocks;
}

declare global {
  var __testMocks: TestMocks | undefined;
}
