import { prisma } from "./prisma";

/** Ensure at least one default account exists; assign orphan trades if any */
export async function ensureAccountsReady() {
  const count = await prisma.account.count();
  if (count === 0) {
    const lucid = await prisma.account.create({
      data: {
        name: "LucidFlex",
        firm: "Lucid",
        type: "EVAL",
        status: "ACTIVE",
        size: 50,
        color: "#34d399",
        startingBalance: 50000,
        currentBalance: 50000,
        profitTarget: 3000,
        maxDrawdown: 2500,
        dailyLossLimit: 1100,
      },
    });
    return lucid;
  }

  // Backfill limits for existing LucidFlex without balance data
  await prisma.account.updateMany({
    where: { name: "LucidFlex", startingBalance: null },
    data: {
      size: 50,
      startingBalance: 50000,
      currentBalance: 50000,
      profitTarget: 3000,
      maxDrawdown: 2500,
      dailyLossLimit: 1100,
    },
  });

  return null;
}

export async function getDefaultAccountId(): Promise<string> {
  await ensureAccountsReady();
  const account = await prisma.account.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
  });
  if (!account) throw new Error("No account found");
  return account.id;
}
