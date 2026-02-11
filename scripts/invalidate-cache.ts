#!/usr/bin/env tsx

/**
 * Manually invalidate skill cache
 */

import { invalidateSkillCache } from "../src/lib/cache";

async function main() {
  console.log("🗑️  Invalidating skill caches...");
  await invalidateSkillCache();
  console.log("✅ Cache invalidated successfully!");
}

main()
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
