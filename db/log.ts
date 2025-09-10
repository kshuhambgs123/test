import { Logs, LogsV2 } from "@prisma/client";
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
): Promise<LogsV2 | null> {
  try {
    const log = await prisma.logsV2.create({
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

export async function getAllLogsByUserID(userID: string): Promise<LogsV2[]> {
  try {
    const logs = await prisma.logsV2.findMany({
      where: {
        userID: userID,
      },
    });

    return logs;
  } catch (error: any) {
    throw new Error(error.message);
  }
}

export async function getAllLogs(): Promise<LogsV2[]> {
  try {
    const logs = await prisma.logsV2.findMany();
    if (!logs) {
      return [];
    }
    return logs;
  } catch (error: any) {
    throw new Error(error.message);
  }
}

export async function getAllV1Logs(): Promise<any> {
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

export async function getOneLog(logID: string): Promise<LogsV2 | null> {
  try {
    const log = await prisma.logsV2.findUnique({
      where: {
        LogID: logID,
      },
    });

    return log;
  } catch (error: any) {
    throw new Error(error.message);
  }
}

export async function getOneLogV1(logID: string): Promise<Logs | null> {
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
): Promise<LogsV2 | null> {
  try {
    const existingLog = await prisma.logsV2.findUnique({
      where: {
        LogID: logID,
      },
    });

    if (!existingLog) {
      return null;
    }

    const log = await prisma.logsV2.update({
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

//
export async function updateLogV1(
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

export async function updateLogByWebhook(
  logID: string,
  status: string,
  url: string,
  valid_email_count: number,
  leadsEnriched: number,
  creditsUsed: number
): Promise<LogsV2 | null> {
  try {
    const existingLog = await prisma.logsV2.findUnique({
      where: {
        LogID: logID,
      },
    });

    if (!existingLog) {
      return null;
    }

    const log = await prisma.logsV2.update({
      where: {
        LogID: logID,
      },
      data: {
        status: status,
        url: url,
        valid_email_count: valid_email_count,
        leadsEnriched: leadsEnriched,
        creditsUsed: creditsUsed,
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
  status: string,
  valid_email_count: number
): Promise<LogsV2 | null> {
  try {
    const deductResult = await deductCredits(userID, creditsUsed);

    if (!deductResult.success) {
      throw new Error("Insufficient Credits");
    }

    const data = await prisma.user.findUnique({
      where: {
        UserID: userID,
      },
    });

    const log = await prisma.logsV2.create({
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
        valid_email_count: valid_email_count,
        email: data?.email || null,
        name: data?.name || null,
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
): Promise<LogsV2 | null> {
  try {
    const log = await prisma.logsV2.create({
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

export async function searchLogs(
              userID: string,
              search_filter?: string,
              pass_filter?: string,
              result_length?: string
): Promise<any> {
  try {
    const log = await prisma.search_logs.create({
      data: {
        user_id : userID,
        search_filter : search_filter,
        pass_filter : pass_filter,
        result : result_length
      },
    });
    return log;
  } catch (error: any) {
    throw new Error(error.message);
  }
}

function safeJSONParse(value: string | null | undefined) {
  try {
    return value ? JSON.parse(value) : null;
  } catch (e) {
    console.warn('Failed to parse JSON:', value);
    return value;
  }
}


export async function getAllUsersSearchLogs(page = 1, pageSize = 10) {
  
  /*
  const skip = (page - 1) * pageSize;
  const rawData = await prisma.search_logs.findMany({
    skip,
    take: pageSize,
    orderBy: {
      createdAt: 'desc', 
    },
  });

  const data = rawData.map((log: any) => ({
      ...log,
      search_filter: safeJSONParse(log.search_filter),
      pass_filter: safeJSONParse(log.pass_filter),
    }));

 const total = await prisma.search_logs.count();
 return {
    data,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
    total,
  };
  */

  const offset = (page - 1) * pageSize;

  const [rawData, total] = await Promise.all([
    prisma.search_logs.findMany({
      skip: offset,
      take: pageSize,
      orderBy: {
        createdAt: 'desc',
      },
    }),
    prisma.search_logs.count(),
  ]);

  // Parse JSON fields
  const data = rawData.map((log) => ({
    ...log,
    search_filter: safeJSONParse(log.search_filter),
    pass_filter: safeJSONParse(log.pass_filter),
  }));

  const pageTotal = Math.ceil(total / pageSize);

  return {
    itemsReceived: data.length,
    curPage: page,
    nextPage: page < pageTotal ? page + 1 : null,
    prevPage: page > 1 ? page - 1 : null,
    offset,
    perPage: pageSize,
    itemsTotal: total,
    pageTotal,
    data,
  };
}