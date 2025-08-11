const PROCESSED_EVENTS_KEY = "webhook_events";
const SUBSCRIPTION_TIMESTAMPS_KEY = "subscription_timestamps";
const EVENT_TTL = 86400; // 24 hours

interface WebhookEventData {
  eventId: string;
  timestamp: number;
  eventType: string;
  subscriptionId?: string;
  processedAt: number;
}

export async function isEventProcessed(eventId: string): Promise<boolean> {
  try {
    const response = await fetch(
      `${process.env.UPSTASH_REDIS_REST_URL}/HEXISTS/${PROCESSED_EVENTS_KEY}/${eventId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
        },
      }
    );

    if (!response.ok) return false;
    const result = await response.json();
    return result.result === 1;
  } catch (error) {
    console.error("Error checking event idempotency:", error);
    return false;
  }
}

export async function markEventProcessed(
  eventId: string,
  eventData: WebhookEventData
): Promise<void> {
  try {
    // Store detailed event data
    await fetch(
      `${
        process.env.UPSTASH_REDIS_REST_URL
      }/HSET/${PROCESSED_EVENTS_KEY}/${eventId}/data/${JSON.stringify(
        eventData
      )}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
        },
      }
    );

    // Set expiry for this specific event
    await fetch(
      `${process.env.UPSTASH_REDIS_REST_URL}/EXPIRE/${PROCESSED_EVENTS_KEY}:${eventId}/${EVENT_TTL}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
        },
      }
    );

    // Update subscription's latest timestamp if applicable
    if (eventData.subscriptionId) {
      await updateSubscriptionTimestamp(
        eventData.subscriptionId,
        eventData.timestamp
      );
    }
  } catch (error) {
    console.error("Error marking event as processed:", error);
  }
}

export async function isEventStale(
  subscriptionId: string,
  incomingTimestamp: number
): Promise<boolean> {
  try {
    const response = await fetch(
      `${process.env.UPSTASH_REDIS_REST_URL}/HGET/${SUBSCRIPTION_TIMESTAMPS_KEY}/${subscriptionId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
        },
      }
    );

    if (!response.ok) return false;

    const result = await response.json();
    if (!result.result) return false;

    const lastProcessedTimestamp = parseInt(result.result);
    return incomingTimestamp <= lastProcessedTimestamp;
  } catch (error) {
    console.error("Error checking event staleness:", error);
    return false;
  }
}

async function updateSubscriptionTimestamp(
  subscriptionId: string,
  timestamp: number
): Promise<void> {
  try {
    await fetch(
      `${process.env.UPSTASH_REDIS_REST_URL}/HSET/${SUBSCRIPTION_TIMESTAMPS_KEY}/${subscriptionId}/timestamp/${timestamp}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
        },
      }
    );

    // Set expiry for timestamp tracking
    await fetch(
      `${process.env.UPSTASH_REDIS_REST_URL}/EXPIRE/${SUBSCRIPTION_TIMESTAMPS_KEY}:${subscriptionId}/${EVENT_TTL}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
        },
      }
    );
  } catch (error) {
    console.error("Error updating subscription timestamp:", error);
  }
}
