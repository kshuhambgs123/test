import { PendingUpgrade } from "@prisma/client";
import { prisma } from "./index";
import { randomUUID } from "crypto";

export async function storePendingUpgrade(data: {
  subscriptionId: string;
  userId: string;
  targetTierName: string;
  targetCredits: number;
  targetPriceId: string;
}): Promise<PendingUpgrade> {
  try {
    // Delete any existing pending upgrade for this subscription
    await prisma.pendingUpgrade.deleteMany({
      where: { subscriptionId: data.subscriptionId },
    });

    // Create new pending upgrade with generated ID
    const pendingUpgrade = await prisma.pendingUpgrade.create({
      data: {
        id: randomUUID(), // Add this line
        subscriptionId: data.subscriptionId,
        userId: data.userId,
        targetTierName: data.targetTierName,
        targetCredits: data.targetCredits,
        targetPriceId: data.targetPriceId,
        expiresAt: new Date(Date.now() + 23 * 60 * 60 * 1000), // 23 hours from now
      },
    });

    console.log(
      `✅ Stored pending upgrade for subscription ${data.subscriptionId}`
    );
    return pendingUpgrade;
  } catch (error: any) {
    console.error("Error storing pending upgrade:", error);
    throw error;
  }
}

// Rest of the functions remain exactly the same
export async function getPendingUpgrade(
  subscriptionId: string
): Promise<PendingUpgrade | null> {
  try {
    const pendingUpgrade = await prisma.pendingUpgrade.findUnique({
      where: { subscriptionId },
    });
    return pendingUpgrade;
  } catch (error: any) {
    console.error("Error getting pending upgrade:", error);
    return null;
  }
}

export async function deletePendingUpgrade(
  subscriptionId: string
): Promise<void> {
  try {
    await prisma.pendingUpgrade.deleteMany({
      where: { subscriptionId },
    });
    console.log(
      `🗑️ Deleted pending upgrade for subscription ${subscriptionId}`
    );
  } catch (error: any) {
    console.error("Error deleting pending upgrade:", error);
  }
}

export async function getPendingUpgradeByUserId(
  userId: string
): Promise<PendingUpgrade | null> {
  try {
    const pendingUpgrade = await prisma.pendingUpgrade.findFirst({
      where: { userId },
    });
    return pendingUpgrade;
  } catch (error: any) {
    console.error("Error getting pending upgrade by user ID:", error);
    return null;
  }
}

export async function cleanupExpiredPendingUpgrades(): Promise<number> {
  try {
    const result = await prisma.pendingUpgrade.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    if (result.count > 0) {
      console.log(`🧹 Cleaned up ${result.count} expired pending upgrades`);
    }

    return result.count;
  } catch (error: any) {
    console.error("Error cleaning up expired pending upgrades:", error);
    return 0;
  }
}
