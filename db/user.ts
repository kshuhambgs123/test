import { User } from "@prisma/client";
import { prisma } from "./index";
import { v4 } from "uuid";

export async function createUser(
  fullName: string,
  companyName: string,
  phoneNumber: string,
  location: string,
  userID: string,
  email: string,
  credits: number,
  subscriptionCredits: number,
  heardFrom: string,
  searchCredits: number,
): Promise<User | null> {
  try {
    const user = await prisma.user.create({
      data: {
        UserID: userID,
        email: email,
        name: fullName,
        companyName: companyName,
        phoneNumber: phoneNumber,
        location: location,
        credits: credits,
        subscriptionCredits: subscriptionCredits,
        apikey: v4(),
        heardFrom: heardFrom,
        searchCredits: searchCredits || 0,
      },
    });

    return user;
  } catch (error: any) {
    throw new Error(error.message);
  }
}

export async function getUser(userID: string): Promise<User | null> {
  try {
    const user = await prisma.user.findUnique({
      where: {
        UserID: userID,
      },
    });
    return user || null;
  } catch (error: any) {
    throw new Error(error.message);
  }
}

export async function addCredits(
  addCreds: number,
  userId: string
): Promise<User | null> {
  try {
    let data = await prisma.user.findUnique({
      where: {
        UserID: userId,
      },
    });

    if (!data) {
      return null;
    }

    data = await prisma.user.update({
      where: {
        UserID: userId,
      },
      data: {
        credits: {
          increment: Math.abs(addCreds),
        },
        TotalCreditsBought: {
          increment: Math.abs(addCreds),
        },
      },
    });

    return data;
  } catch (error: any) {
    throw new Error(error.message);
  }
}

export async function refreshAPIKey(userID: string): Promise<User | null> {
  try {
    const user = await prisma.user.update({
      where: {
        UserID: userID,
      },
      data: {
        apikey: v4(),
      },
    });

    return user;
  } catch (error: any) {
    throw new Error(error.message);
  }
}

export async function removeCredits(
  removeCreds: number,
  userId: string
): Promise<User | null> {
  try {
    let data = await prisma.user.findUnique({
      where: {
        UserID: userId,
      },
    });

    if (!data) {
      return null;
    }

    data = await prisma.user.update({
      where: {
        UserID: userId,
      },
      data: {
        credits: {
          decrement: Math.abs(removeCreds),
        },
        TotalCreditsUsed: {
          increment: Math.abs(removeCreds),
        },
      },
    });

    return data;
  } catch (error: any) {
    throw new Error(error.message);
  }
}

export async function getCredits(userID: string): Promise<number | null> {
  try {
    const data = await prisma.user.findUnique({
      where: {
        UserID: userID,
      },
    });

    return data ? data.credits : null;
  } catch (error: any) {
    throw new Error(error.message);
  }
}
