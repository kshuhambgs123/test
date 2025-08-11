import { UpstashResponse } from "../types/interfaces";
import dotenv from "dotenv";
dotenv.config();

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const CACHE_KEY = "searchleads_subscription_tiers";
const DEFAULT_TTL = Number(process.env.UPSTASH_REDIS_TTL) || 3600; // 1 hour in seconds

async function makeUpstashRequest(command: string[]): Promise<UpstashResponse> {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    console.warn("Upstash Redis not configured, skipping cache operation");
    return { error: "Redis not configured" };
  }

  try {
    const response = await fetch(`${UPSTASH_URL}/${command.join("/")}`, {
      headers: {
        Authorization: `Bearer ${UPSTASH_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Redis request failed: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Redis operation failed:", error);
    return { error: (error as Error).message };
  }
}

export async function getCachedTiers(): Promise<any | null> {
  try {
    const response = await makeUpstashRequest(["GET", CACHE_KEY]);

    if (response.error || !response.result) {
      return null;
    }

    const cachedData = JSON.parse(response.result);
    console.log("Retrieved subscription tiers from Redis cache");
    return cachedData;
  } catch (error) {
    console.error("Error getting cached tiers:", error);
    return null;
  }
}

export async function setCachedTiers(
  tiers: any,
  ttlSeconds: number = DEFAULT_TTL
): Promise<boolean> {
  try {
    const response = await makeUpstashRequest([
      "SETEX",
      CACHE_KEY,
      ttlSeconds.toString(),
      JSON.stringify(tiers),
    ]);

    if (response.error) {
      console.error("Error setting cached tiers:", response.error);
      return false;
    }

    console.log(`Cached subscription tiers for ${ttlSeconds} seconds`);
    return true;
  } catch (error) {
    console.error("Error setting cached tiers:", error);
    return false;
  }
}

export async function clearCachedTiers(): Promise<boolean> {
  try {
    const response = await makeUpstashRequest(["DEL", CACHE_KEY]);

    if (response.error) {
      console.error("Error clearing cached tiers:", response.error);
      return false;
    }

    console.log("Cleared subscription tiers cache");
    return true;
  } catch (error) {
    console.error("Error clearing cached tiers:", error);
    return false;
  }
}

export async function getCacheInfo(): Promise<{
  exists: boolean;
  ttl?: number;
}> {
  try {
    const existsResponse = await makeUpstashRequest(["EXISTS", CACHE_KEY]);
    const exists = existsResponse.result === 1;

    if (!exists) {
      return { exists: false };
    }

    const ttlResponse = await makeUpstashRequest(["TTL", CACHE_KEY]);
    const ttl = ttlResponse.result || -1;

    return { exists: true, ttl };
  } catch (error) {
    console.error("Error getting cache info:", error);
    return { exists: false };
  }
}
