import { Logs } from "@prisma/client";
import { prisma } from "./index";
import { deductCredits } from "./subscription";

// create
export async function createLog(
  logID: string,
  userID: string,
  leadsRequested: number,
  leadsEnriched: number,
  apolloLink: string,
  fileName: string,
  creditsUsed: number,
  url: string,
  name: string,
  email: string
): Promise<Logs | null> {
  try {
    const log = await prisma.logs.create({
      data: {
        LogID: logID,
        userID: userID,
        leadsRequested: leadsRequested,
        leadsEnriched: leadsEnriched,
        apolloLink: apolloLink,
        fileName: fileName,
        creditsUsed: creditsUsed,
        url: url,
        status: "pending",
        date: new Date(),
        name: name,
        email: email,
      },
    });

    return log;
  } catch (error: any) {
    throw new Error(error.message);
  }
}

// get all

export async function getAllLogsByUserID(userID: string): Promise<Logs[]> {
  try {
    const logs = await prisma.logs.findMany({
      where: {
        userID: userID,
      },
    });

    return logs;
  } catch (error: any) {
    throw new Error(error.message);
  }
}

export async function getAllLogs(): Promise<Logs[]> {
  try {
    const logs = await prisma.logs.findMany();
    if (!logs) {
      return [];
    }
    return logs;
  } catch (error: any) {
    throw new Error(error.message);
  }
}

//getone

export async function getOneLog(logID: string): Promise<Logs | null> {
  try {
    const log = await prisma.logs.findUnique({
      where: {
        LogID: logID,
      },
    });

    return log;
  } catch (error: any) {
    throw new Error(error.message);
  }
}

//update

export async function updateLog(
  logID: string,
  status: string,
  url: string,
  leadsEnriched: number
): Promise<Logs | null> {
  try {
    const existingLog = await prisma.logs.findUnique({
      where: {
        LogID: logID,
      },
    });

    if (!existingLog) {
      return null;
    }

    const log = await prisma.logs.update({
      where: {
        LogID: logID,
      },
      data: {
        status: status,
        url: url,
        leadsEnriched: leadsEnriched,
      },
    });

    return log;
  } catch (error: any) {
    throw new Error(error.message);
  }
}

export async function createCompleteLog(
  logID: string,
  userID: string,
  leadsRequested: number,
  leadsEnriched: number,
  apolloLink: string,
  fileName: string,
  creditsUsed: number,
  url: string,
  status: string
): Promise<Logs | null> {
  try {
    const deductResult = await deductCredits(userID, creditsUsed);

    if (!deductResult.success) {
      throw new Error("Insufficient Credits");
    }

    const log = await prisma.logs.create({
      data: {
        LogID: logID,
        userID: userID,
        leadsRequested: leadsRequested,
        leadsEnriched: leadsEnriched,
        apolloLink: apolloLink,
        fileName: fileName,
        creditsUsed: creditsUsed,
        url: url,
        status: status,
        date: new Date(),
      },
    });

    return log;
  } catch (error: any) {
    throw new Error(error.message);
  }
}

export async function createLogOnly(
  logID: string,
  userID: string,
  leadsRequested: number,
  leadsEnriched: number,
  apolloLink: string,
  fileName: string,
  creditsUsed: number,
  url: string,
  userName: string,
  userEmail: string
): Promise<Logs | null> {
  try {
    const log = await prisma.logs.create({
      data: {
        LogID: logID,
        userID: userID,
        leadsRequested: leadsRequested,
        leadsEnriched: leadsEnriched,
        apolloLink: apolloLink,
        fileName: fileName,
        creditsUsed: creditsUsed,
        url: url,
        status: "pending",
        date: new Date(),
        name: userName,
        email: userEmail,
      },
    });
    return log;
  } catch (error: any) {
    throw new Error(error.message);
  }
}
