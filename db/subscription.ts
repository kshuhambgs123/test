import { User } from "@prisma/client";
import { prisma } from "./index";
import { stripeClient } from "../payments/stripe";
import {
  getCachedTiers,
  setCachedTiers,
  clearCachedTiers,
} from "../caching/redis";

const percentageOfCredits = process.env.PERCENTAGE ? parseInt(process.env.PERCENTAGE, 10) : 10;
async function fetchDynamicTiers() {
  try {
    console.log("Fetching subscription tiers from Stripe.");

    const prices = await stripeClient.prices.list({
      active: true,
      type: "recurring",
      expand: ["data.product"],
      limit: 50,
    });

    const tiers: any = {};

    for (const price of prices.data) {
      const product = price.product as any;

      if (price.recurring?.interval !== "month") continue;

      // Product Naming Convention: Use format "searchleads_recurring_tier_[TIER]" for auto-detection
      // Examples: "searchleads_recurring_tier_10k", "searchleads_recurring_tier_25k"
      // Won't work: "SearchLeads 10K Plan", "other_product_tier_10k"
      // Extracts tier name and credits from the structured product name
      const tierMatch = product.name.match(
        /^searchleads_recurring_tier_(\d+k)$/i
      );
      if (!tierMatch || !price.unit_amount) continue;

      const tierName = `searchleads_recurring_tier_${tierMatch[1].toLowerCase()}`;
      const creditsK = parseInt(tierMatch[1].replace(/k$/i, ""));
      const credits = creditsK * 1000;

      tiers[tierName] = {
        priceId: price.id,
        credits: credits,
        amount: price.unit_amount,
        productName: product.name,
        productId: product.id,
      };
    }

    console.log(`Loaded ${Object.keys(tiers).length} subscription tiers`);
    return tiers;
  } catch (error) {
    console.error("Error fetching tiers from Stripe:", error);
    return null;
  }
}

export async function getSubscriptionTiers() {
  const cachedTiers = await getCachedTiers();
  if (cachedTiers && Object.keys(cachedTiers).length > 0) {
    return cachedTiers;
  }

  // Cache miss
  const freshTiers = await fetchDynamicTiers();

  if (freshTiers && Object.keys(freshTiers).length > 0) {
    await setCachedTiers(freshTiers);
    return freshTiers;
  }

  if (cachedTiers) {
    console.warn("Using cached tiers due to Stripe API error");
    return cachedTiers;
  }

  throw new Error("Unable to load subscription tiers");
}

export async function refreshTiers() {
  await clearCachedTiers();
  return await getSubscriptionTiers();
}

export async function getAvailableTierNames(): Promise<string[]> {
  const tiers = await getSubscriptionTiers();
  return Object.keys(tiers);
}

export async function setUpgradeLock(userId: string, locked: boolean) {
  console.log(
    `${locked ? "🔒" : "🔓"} ${
      locked ? "Setting" : "Clearing"
    } upgrade lock for user ${userId}`
  );

  try {
    const user = await prisma.user.update({
      where: { UserID: userId },
      data: { upgrade_lock: locked },
    });

    console.log(`✅ Updated upgrade lock to ${locked}`);
  } catch (error: any) {
    throw new Error(error.message);
  }
}

export async function updateUserSubscription(
  userId: string,
  subscriptionData: {
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    subscriptionStatus?: string | null;
    subscriptionCurrentPeriodEnd?: Date | null;
    subscriptionPlan?: string | null;
    subscriptionCredits?: number;
    last_webhook_timestamp?: string | null;
    last_processed_event_id?: string | null;
  }
): Promise<User | null> {
  try {
    const user = await prisma.user.update({
      where: { UserID: userId },
      data: subscriptionData,
    });

    console.log(
      `Successfully updated user ${userId} subscription data:`,
      subscriptionData
    );
    return user;
  } catch (error: any) {
    console.error(`Error updating user ${userId} subscription:`, error);
    throw error; // Re-throw to handle in webhook
  }
}

export async function updateUserSubscriptionWithTimestamp(
  userId: string,
  subscriptionData: {
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    subscriptionStatus?: string | null;
    subscriptionCurrentPeriodEnd?: Date | null;
    subscriptionPlan?: string | null;
    subscriptionCredits?: number;
    last_webhook_timestamp?: number;
    last_processed_event_id?: string;
    upgrade_lock?: boolean;
    searchCredits?: number;
  }
): Promise<User | null> {
  try {
    const dbData: any = { ...subscriptionData };

    if (subscriptionData.last_webhook_timestamp) {
      dbData.last_webhook_timestamp = new Date(
        subscriptionData.last_webhook_timestamp * 1000
      );
    }

    const user = await prisma.user.update({
      where: { UserID: userId },
      data: dbData,
    });

    console.log(
      `✅ Updated user ${userId} with timestamp ${subscriptionData.last_webhook_timestamp}`
    );
    return user;
  } catch (error: any) {
    console.error(`Error updating user ${userId} subscription:`, error);
    throw error;
  }
}

export async function resetMonthlyCredits(
  userId: string,
  credits: number
): Promise<User | null> {
  try {
    const user = await prisma.user.update({
      where: { UserID: userId },
      data: {
        subscriptionCredits: credits,
        searchCredits: parseFloat(((credits * percentageOfCredits) / 100).toString()),
        TotalCreditsBought: { increment: credits },
      },
    });
    return user;
  } catch (error: any) {
    console.error("Error resetting monthly credits:", error);
    return null;
  }
}

export async function getUserByStripeCustomerId(
  customerId: string
): Promise<User | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { stripeCustomerId: customerId },
    });
    return user;
  } catch (error: any) {
    console.error("Error finding user by stripe customer ID:", error);
    return null;
  }
}

export async function deductCredits(
  userId: string,
  creditsToDeduct: number
): Promise<{ success: boolean; remainingCredits: number }> {
  try {
    const user = await prisma.user.findUnique({
      where: { UserID: userId },
    });

    if (!user) {
      return { success: false, remainingCredits: 0 };
    }

    const totalCredits = (user.subscriptionCredits ?? 0) + user.credits;

    if (totalCredits < creditsToDeduct) {
      return { success: false, remainingCredits: totalCredits };
    }

    // Deduct from subscription credits first, then purchased credits
    let remainingToDeduct = creditsToDeduct;
    let newSubscriptionCredits = user.subscriptionCredits ?? 0;
    let newPurchasedCredits = user.credits;

    if (newSubscriptionCredits >= remainingToDeduct) {
      newSubscriptionCredits -= remainingToDeduct;
    } else {
      remainingToDeduct -= newSubscriptionCredits;
      newSubscriptionCredits = 0;
      newPurchasedCredits -= remainingToDeduct;
    }

    await prisma.user.update({
      where: { UserID: userId },
      data: {
        subscriptionCredits: newSubscriptionCredits,
        credits: newPurchasedCredits,
        TotalCreditsUsed: {
          increment: creditsToDeduct,
        },
      },
    });

    return {
      success: true,
      remainingCredits: newSubscriptionCredits + newPurchasedCredits,
    };
  } catch (error: any) {
    console.error("Error deducting credits:", error);
    return { success: false, remainingCredits: 0 };
  }
}

export async function deductSearchCredits(
  userId: string,
  creditsToDeduct: number
): Promise<{ success: boolean; remainingCredits: number }> {
  try {
    const user = await prisma.user.findUnique({
      where: { UserID: userId },
    });

    if (!user) {
      return { success: false, remainingCredits: 0 };
    }

    const totalCredits = user.searchCredits ?? 0;

    if (totalCredits < creditsToDeduct) {
      return { success: false, remainingCredits: totalCredits };
    }

    // Deduct from search credits 
    let remainingToDeduct = creditsToDeduct;
    let newSearchCredits = user.searchCredits ?? 0;
    // let newPurchasedCredits = user.credits;

    if (newSearchCredits >= remainingToDeduct) {
      newSearchCredits -= remainingToDeduct;
    } 
    // else {
    //   remainingToDeduct -= newSubscriptionCredits;
    //   newSubscriptionCredits = 0;
    //   newPurchasedCredits -= remainingToDeduct;
    // }

    await prisma.user.update({
      where: { UserID: userId },
      data: {
        searchCredits: newSearchCredits,
        searchCreditsUsed: {
          increment: creditsToDeduct,
        },
      },
    });

    return {
      success: true,
      remainingCredits: newSearchCredits,
      // remainingCredits: newSubscriptionCredits + newPurchasedCredits,
    };
  } catch (error: any) {
    console.error("Error deducting credits:", error);
    return { success: false, remainingCredits: 0 };
  }
}
