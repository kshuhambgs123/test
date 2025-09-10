import { prisma } from "./index";
import { v4 as uuid } from "uuid";
import { adminAuth } from "./admindb";

export async function adminLogin(email: string, password: string) {
  const data = await prisma.admin.findUnique({
    where: {
      email: email,
      password: password,
    },
  });
  if (!data) {
    return null;
  }
  const token = uuid();
  await adminAuth.set(token, data.email);

  return token;
}

export async function getAllUsers() {
  const data = await prisma.user.findMany();
  return data;
}

export async function getAllUsersWithFutureSubscription() : Promise<any> {
  const data = await prisma.user.findMany();
  return data;
}

export async function generateAPIkey(userID: string) {
  const key = uuid() as string;

  const data = await prisma.user.update({
    where: {
      UserID: userID,
    },
    data: {
      apikey: key,
    },
  });

  return data;
}

export async function tokenVerify(token: string) {
  const data = await adminAuth.get(token);
  return data;
}

export async function getAllApikeys() {
  const data = await prisma.user.findMany({
    select: {
      apikey: true,
    },
  });

  return data;
}

export async function getApiKey(userID: string) {
  const data = await prisma.user.findUnique({
    where: {
      UserID: userID,
    },
  });

  console.log(data);

  return data?.apikey;
}

export async function updateCredits(userID: string, credits: number) {
  const data = await prisma.user.findUnique({
    where: {
      UserID: userID,
    },
  });

  if (!data) {
    return null;
  }

  const updatedCredits = data.credits + credits;

  if (updatedCredits < 0) {
    return "negative";
  }

  let updatedData;

  if (credits > 0) {
    updatedData = await prisma.user.update({
      where: {
        UserID: userID,
      },
      data: {
        credits: updatedCredits,
        TotalCreditsBought: {
          increment: credits,
        },
      },
    });
  } else if (credits < 0) {
    updatedData = await prisma.user.update({
      where: {
        UserID: userID,
      },
      data: {
        credits: updatedCredits,
        TotalCreditsUsed: {
          increment: Math.abs(credits),
        },
      },
    });
  } else {
    return null;
  }

  if (!updatedData) {
    return null;
  }

  return updatedData;
}

export async function updateCreditsForOneAmongAll(userID: string, credits: number, type?: string) {
  const data = await prisma.user.findUnique({
    where: {
      UserID: userID,
    },
  });

  if (!data) {
    return null;
  }


  let updatedData;

  if(type == "enrich_credits"){
    const updatedCredits = (data.credits ?? 0) + credits;
    if (updatedCredits < 0) {
      return "negative";
    }
    if (credits > 0) {
      updatedData = await prisma.user.update({
        where: {
          UserID: userID,
        },
        data: {
          credits: updatedCredits,
          TotalCreditsBought: {
            increment: credits,
          },
        },
      });
    } else if (credits < 0) {
      updatedData = await prisma.user.update({
        where: {
          UserID: userID,
        },
        data: {
          credits: updatedCredits,
          TotalCreditsUsed: {
            increment: Math.abs(credits),
          },
        },
      });
    } else {
      return null;
    }
  } else if(type == "search_credits"){
    const updatedSearchCredits = (data.searchCredits ?? 0) + credits;
    if (updatedSearchCredits < 0) {
      return "negative";
    }
    if (credits > 0) {
      updatedData = await prisma.user.update({
        where: {
          UserID: userID,
        },
        data: {
        searchCredits: updatedSearchCredits,
        // searchCredits: {
        //   increment: Math.abs(updatedSearchCredits),
        // },
        },
      });
    } else if (credits < 0) {
      updatedData = await prisma.user.update({
        where: {
          UserID: userID,
        },
        data: {
          searchCredits: updatedSearchCredits,
          searchCreditsUsed: {
            increment: Math.abs(credits),
          },
        },
      });
    }
    else {
    return null;
  }
  } else if(type == "subscription_credits"){
    const updatedSubscriptionCredits = (data.subscriptionCredits ?? 0) + credits;
    if (updatedSubscriptionCredits < 0) {
      return "negative";
    }
    if (credits > 0) {
      updatedData = await prisma.user.update({
        where: {
          UserID: userID,
        },
        data: {
          subscriptionCredits: updatedSubscriptionCredits,
        },
      });
    } else if (credits < 0) {
      updatedData = await prisma.user.update({
        where: {
          UserID: userID,
        },
        data: {
          subscriptionCredits: updatedSubscriptionCredits,
        },
      });
    }
    else {
    return null;
  }
  }

  if (!updatedData) {
    return null;
  }

  return updatedData;
}

export async function updateCreditsRefunded(userID: string, credits: number , log_id: string) {
  const data = await prisma.user.findUnique({
    where: {
      UserID: userID,
    },
  });

  if (!data) {
    return null;
  }

   const log = await prisma.logsV2.findUnique({
    where: {
      LogID: log_id,
    },
  });

  // const creditToRefund = log?.leadsRequested ?? 0 - credits > 0 ? log?.leadsRequested ?? 0 - credits : 0;
  const leadsRequested = log?.leadsRequested ?? 0;
  const creditToRefund = leadsRequested > credits ? leadsRequested - credits : 0;

  console.log("Credit to refund to user:",leadsRequested, creditToRefund);
  const updatedCredits = data.credits + creditToRefund;

  if (updatedCredits < 0) {
    return "negative";
  }

  let updatedData;

  if (credits > 0) {
    updatedData = await prisma.user.update({
      where: {
        UserID: userID,
      },
      data: {
        refundCredits: { 
          increment: credits,
        },
        credits: {
          increment: creditToRefund,
        },
        TotalCreditsBought: {
          increment: credits,
        },
      },
    });
  } else if (credits < 0) {
    updatedData = await prisma.user.update({
      where: {
        UserID: userID,
      },
      data: {
        refundCredits:{
          increment: credits,
        },
        credits: updatedCredits,
        TotalCreditsUsed: {
          increment: Math.abs(credits),
        },
      },
    });
  } else {
    return null;
  }

  if (!updatedData) {
    return null;
  }

  return updatedData;
}

export async function getUserById(userID: string) {
  const data = await prisma.user.findUnique({
    where: {
      UserID: userID,
    },
  });

  return data;
}

export async function getLogsByUserID(userID: string) {
  try {
    const data = await prisma.logsV2.findMany({
      where: {
        userID: userID,
      },
    });
    return data;
  } catch (error) {
    console.error("Database error:", error);
    // Attempt to reconnect
    // await prisma.$disconnect();
    // Retry once
    return await prisma.logsV2.findMany({
      where: {
        userID: userID,
      },
    });
  }
}

export async function revokeAPIkey(userID: string) {
  const data = await prisma.user.update({
    where: {
      UserID: userID,
    },
    data: {
      apikey: null,
    },
  });

  return data;
}

export async function editLog(
  logID: string,
  status: string,
  apollo_link: string,
  credits: number,
  url: string,
  valid_email_count: number
) {
  const log = await prisma.logsV2.findUnique({
    where: {
      LogID: logID,
    },
  });

  if (!log) {
    return null;
  }
  console.log(log.creditsUsed);
  console.log(credits);
  if (log.creditsUsed > credits) {
    const refCRED = log.creditsUsed - credits;
    const refingCred = await prisma.user.update({
      where: {
        UserID: log.userID,
      },
      data: {
        credits: {
          increment: refCRED,
        },
      },
    });

    console.log(refingCred.credits);
    if (!refingCred) {
      return null;
    }
  }

  const data = await prisma.logsV2.update({
    where: {
      LogID: logID,
    },
    data: {
      status: status,
      apolloLink: apollo_link,
      creditsUsed: credits,
      url: url,
      valid_email_count: valid_email_count
    },
  });

  return data;
}

//
export async function editLogV1(logID: string, status: string,apollo_link: string, credits: number,  url: string) {
    const log = await prisma.logs.findUnique({
        where: {
            LogID: logID
        }
    });

    if (!log) {
        return null;
    }
    console.log(log.creditsUsed);
    console.log(credits);
    if(log.creditsUsed > credits){
        const refCRED = log.creditsUsed - credits;
        const refingCred = await prisma.user.update({
            where: {
                UserID: log.userID
            },
            data: {
                credits: {
                    increment: refCRED
                }
            }
        });

        console.log(refingCred.credits);
        if (!refingCred) {
            return null;
        }
    }

    const data = await prisma.logs.update({
        where: {
            LogID: logID
        },
        data: {
            status: status,
            apolloLink: apollo_link,
            creditsUsed: credits,
            url: url
        }
    });

    return data;
}
