/**
 * One-time migration: add Account table and link existing trades to LucidFlex
 * Run: node prisma/migrate-accounts.js
 */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const accountCount = await prisma.account.count();
  let defaultAccount;

  if (accountCount === 0) {
    defaultAccount = await prisma.account.create({
      data: {
        name: "LucidFlex",
        firm: "Lucid",
        type: "EVAL",
        status: "ACTIVE",
        color: "#34d399",
      },
    });
    console.log("Created default account:", defaultAccount.name);
  } else {
    defaultAccount = await prisma.account.findFirst({ orderBy: { createdAt: "asc" } });
    console.log("Using existing account:", defaultAccount?.name);
  }

  if (!defaultAccount) {
    console.error("No account available");
    process.exit(1);
  }

  // Raw SQL to update trades without accountId (if column was added nullable)
  try {
    const result = await prisma.$executeRawUnsafe(
      `UPDATE Trade SET accountId = ? WHERE accountId IS NULL OR accountId = ''`,
      defaultAccount.id
    );
    console.log("Updated trades:", result);
  } catch (e) {
    console.log("Trade update skipped (schema may already be migrated):", e.message);
  }

  console.log("Done.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
