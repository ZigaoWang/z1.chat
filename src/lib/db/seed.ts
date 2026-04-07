import { db } from "./index";
import { users } from "./schema";

const DEV_USER_ID = "00000000-0000-0000-0000-000000000001";

async function seed() {
  console.log("Seeding database...");

  // Create dev user (upsert)
  await db
    .insert(users)
    .values({
      id: DEV_USER_ID,
      email: "dev@one.local",
      name: "Developer",
      preferences: {
        theme: "system",
        defaultModel: null,
        responseStyle: "balanced",
        language: null,
        customInstructions: null,
      },
    })
    .onConflictDoNothing();

  console.log("Seed complete. Dev user ID:", DEV_USER_ID);
  process.exit(0);
}

seed().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
