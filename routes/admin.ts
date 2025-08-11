// admin.ts

import { Logs } from "@prisma/client";
import express, { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { v4 } from "uuid";
import {} from "../";
import {
  adminLogin,
  editLog,
  generateAPIkey,
  getAllApikeys,
  getAllUsers,
  getApiKey,
  getLogsByUserID,
  getUserById,
  revokeAPIkey,
  tokenVerify,
  updateCredits,
} from "../db/admin";
import { getAllInvoices, getInvoiceByBillingID } from "../db/billing";
import {
  createCompleteLog,
  getAllLogs,
  getAllLogsByUserID,
  getOneLog,
  updateLog,
} from "../db/log";
import adminVerification from "../middleware/adminAuth";
import { getSubscriptionTiers, refreshTiers } from "../db/subscription";
import {
  LoginRequest,
  ChangePriceRequest,
  ChangeAutomationLinkRequest,
  ChangeStatusRequest,
  ChangeDNSRequest,
  UpdateCreditsRequest,
  ChangeEnrichPriceRequest,
  LeadStatusResponse,
} from "../types/interfaces";

const app = express.Router();

// Login route
app.post("/login", async (req: LoginRequest, res: Response) => {
  //TESTED
  try {
    const { email, password } = req.body;
    const resp = await adminLogin(email, password);
    if (!resp) {
      throw new Error("no admin account");
    }
    res.status(200).json({ message: "authorised", token: resp });
  } catch (error: any) {
    res.status(404).json({ message: error.message });
  }
});

app.post("/verifyToken", async (req: Request, res: Response) => {
  //TESTED
  try {
    const { token } = req.body;
    const resp = await tokenVerify(token);
    if (!resp) {
      throw new Error("invalid token");
    }

    res.status(200).json({ message: "authorised" });
  } catch (error: any) {
    res.status(404).json({ message: error.message });
  }
});

// Get price
app.get("/getPrice", adminVerification, async (req: Request, res: Response) => {
  //TESTED
  try {
    if (!process.env.COSTPERLEAD) {
      throw new Error("no price set");
    }
    res.status(200).json({ resp: process.env.COSTPERLEAD });
  } catch (error: any) {
    res.status(404).json({ error: error.message });
  }
});

// Change price
app.post(
  "/changePrice",
  adminVerification,
  async (req: ChangePriceRequest, res: Response) => {
    //TESTED
    try {
      const { newPrice } = req.body;
      if (isNaN(newPrice) || !newPrice) {
        throw new Error("Invalid price");
      }

      process.env.COSTPERLEAD = newPrice.toString();

      const envFilePath = path.resolve(__dirname, "../.env");
      if (!fs.existsSync(envFilePath)) {
        throw new Error(".env file not found");
      }

      let envFileContent = fs.readFileSync(envFilePath, "utf8");
      const newEnvFileContent = envFileContent.replace(
        /(^|\n)COSTPERLEAD=.*/,
        `$1COSTPERLEAD=${newPrice}`
      );
      fs.writeFileSync(envFilePath, newEnvFileContent);

      res.status(200).json({ resp: "updated price" });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

// Change automation link
app.post(
  "/changeAutomationLink",
  adminVerification,
  async (req: ChangeAutomationLinkRequest, res: Response) => {
    //TESTED
    try {
      const { automationLink } = req.body;
      if (!automationLink) {
        throw new Error("Invalid link");
      }

      process.env.SEARCHAUTOMATIONAPI = automationLink.toString();

      const envFilePath = path.resolve(__dirname, "../.env");
      if (!fs.existsSync(envFilePath)) {
        throw new Error(".env file not found");
      }

      let envFileContent = fs.readFileSync(envFilePath, "utf8");
      const newEnvFileContent = envFileContent.replace(
        /(^|\n)SEARCHAUTOMATIONAPI=.*/,
        `$1SEARCHAUTOMATIONAPI=${automationLink}`
      );
      fs.writeFileSync(envFilePath, newEnvFileContent);

      res.status(200).json({ resp: "updated automation linke" });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

// Change status link
app.post(
  "/changeStatusLink",
  adminVerification,
  async (req: ChangeStatusRequest, res: Response) => {
    //TESTED
    try {
      const { statusLink } = req.body;
      if (!statusLink) {
        throw new Error("Invalid link");
      }

      process.env.SEARCHAUTOMATIONAPISTATUS = statusLink.toString();

      const envFilePath = path.resolve(__dirname, "../.env");
      if (!fs.existsSync(envFilePath)) {
        throw new Error(".env file not found");
      }

      let envFileContent = fs.readFileSync(envFilePath, "utf8");
      const newEnvFileContent = envFileContent.replace(
        /(^|\n)SEARCHAUTOMATIONAPISTATUS=.*/,
        `$1SEARCHAUTOMATIONAPISTATUS=${statusLink}`
      );
      fs.writeFileSync(envFilePath, newEnvFileContent);

      res.status(200).json({ resp: "updated automation linke" });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

// Change DNS
app.post(
  "/changeDNS",
  adminVerification,
  async (req: ChangeDNSRequest, res: Response) => {
    //TESTED
    try {
      const { newDNS } = req.body;
      if (!newDNS) {
        throw new Error("Invalid link");
      }

      process.env.DNS = newDNS.toString();

      const envFilePath = path.resolve(__dirname, "../.env");
      if (!fs.existsSync(envFilePath)) {
        throw new Error(".env file not found");
      }

      let envFileContent = fs.readFileSync(envFilePath, "utf8");
      const newEnvFileContent = envFileContent.replace(
        /(^|\n)DNS=.*/,
        `$1DNS=${newDNS}`
      );
      fs.writeFileSync(envFilePath, newEnvFileContent);

      res.status(200).json({ resp: "updated automation linke" });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

// Get all users
app.get(
  "/getAllUsers",
  adminVerification,
  async (req: Request, res: Response) => {
    //TESTED
    try {
      const resp = await getAllUsers();
      res.status(200).json({ resp });
    } catch (error: any) {
      res.status(404).json({ message: error.message });
    }
  }
);

app.get(
  "/getAllApikeys",
  adminVerification,
  async (req: Request, res: Response) => {
    //TESTED
    try {
      const resp = await getAllApikeys();
      res.status(200).json({ resp });
    } catch (error: any) {
      res.status(404).json({ message: error.message });
    }
  }
);

app.post(
  "/generateAPIkey",
  adminVerification,
  async (req: Request, res: Response) => {
    //TESTED
    try {
      const { userID } = req.body;
      const resp = await generateAPIkey(userID);
      if (!resp) {
        throw new Error("failed to generate key");
      }
      res.status(200).json({ resp });
    } catch (error: any) {
      res.status(404).json({ message: error.message });
    }
  }
);

app.post(
  "/getAPIkey",
  adminVerification,
  async (req: Request, res: Response) => {
    //TESTED
    try {
      const { userID } = req.body;
      const resp = await getApiKey(userID);
      if (!resp) {
        throw new Error("this account do not have APIKEY access");
      }
      res.status(200).json({ resp });
    } catch (error: any) {
      res.status(404).json({ message: error.message });
    }
  }
);

app.post(
  "/revokeAPIkey",
  adminVerification,
  async (req: Request, res: Response) => {
    //TESTED
    try {
      const { userID } = req.body;
      const resp = await revokeAPIkey(userID);
      if (!resp) {
        throw new Error("failed to revoke key");
      }
      res.status(200).json({ resp });
    } catch (error: any) {
      res.status(404).json({ message: error.message });
    }
  }
);

// Update credits
app.post(
  "/updateCredits",
  adminVerification,
  async (req: UpdateCreditsRequest, res: Response) => {
    //TESTED
    try {
      const { userID, credits } = req.body;
      const resp = await updateCredits(userID, credits);
      if (resp === "negative") {
        throw new Error("credits cannot be negative");
      }
      if (!resp) {
        throw new Error("failed to update credits");
      }
      res.status(200).json({ resp });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }
);

// Get user by ID
app.post("/getUser", adminVerification, async (req: Request, res: Response) => {
  //TESTED
  try {
    const { userID } = req.body;
    const data = await getUserById(userID);
    if (!data) {
      throw new Error("user not found");
    }
    res.status(200).json({ data });
  } catch (error: any) {
    res.status(404).json({ message: error.message });
  }
});

app.post(
  "/getAllLogsById",
  adminVerification,
  async (req: Request, res: Response) => {
    //TESTED
    try {
      const { userID } = req.body;

      const data = await getLogsByUserID(userID);
      if (!data) {
        throw new Error("failed to find logs");
      }
      res.status(200).json({ data });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }
);

app.get(
  "/getAllLogs",
  adminVerification,
  async (req: Request, res: Response) => {
    //TESTED
    try {
      const data = await getAllLogs();

      if (!data) {
        throw new Error("failed to find logs");
      }
      res.status(200).json({ data });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }
);

app.post(
  "/changeRegistrationCredits",
  adminVerification,
  async (req: ChangeEnrichPriceRequest, res: Response) => {
    //TESTED
    try {
      const { newPrice } = req.body;
      if (isNaN(newPrice) || !newPrice) {
        throw new Error("Invalid price");
      }

      process.env.RegistrationCredits = newPrice.toString();

      const envFilePath = path.resolve(__dirname, "../../.env");
      if (!fs.existsSync(envFilePath)) {
        throw new Error(".env file not found");
      }

      let envFileContent = fs.readFileSync(envFilePath, "utf8");
      const newEnvFileContent = envFileContent.replace(
        /(^|\n)RegistrationCredits=.*/,
        `$1RegistrationCredits=${newPrice}`
      );
      fs.writeFileSync(envFilePath, newEnvFileContent);

      res.status(200).json({ resp: "updated registration credits" });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

app.get(
  "/getRegistrationCredits",
  adminVerification,
  async (req: Request, res: Response) => {
    //TESTED
    try {
      if (!process.env.RegistrationCredits) {
        throw new Error("no price set");
      }
      res.status(200).json({ resp: process.env.RegistrationCredits });
    } catch (error: any) {
      res.status(404).json({ error: error.message });
    }
  }
);

app.post(
  "/createUserLog",
  adminVerification,
  async (req: Request, res: Response) => {
    try {
      const {
        userID,
        leadsRequested,
        leadsEnriched,
        apolloLink,
        fileName,
        creditsUsed,
        url,
        status,
      } = req.body;

      if (
        !userID ||
        !leadsRequested ||
        !leadsEnriched ||
        !apolloLink ||
        !fileName ||
        !url ||
        !status
      ) {
        res.status(400).json({ message: "Missing fields" });
        return;
      }

      const createCompleteLogData = await createCompleteLog(
        v4(),
        userID,
        leadsRequested,
        leadsEnriched,
        apolloLink,
        fileName,
        creditsUsed,
        url,
        status
      );

      if (!createCompleteLogData) {
        res.status(400).json({ message: "Failed to create log" });
        return;
      }

      res.status(200).json({
        message: "Log created successfully",
        log: createCompleteLogData,
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }
);

app.post(
  "/retryLog",
  adminVerification,
  async (req: Request, res: Response) => {
    try {
      const { logID } = req.body;

      const log = await getOneLog(logID);

      if (!log) {
        res.status(404).json({ message: "Log not found" });
        return;
      }

      res
        .status(200)
        .json({ message: "Log found retry function started", log });

      setImmediate(async () => {
        console.log("Checking lead status for logID: ", log?.LogID);
        const resp = await checkLeadStatus(log as Logs);
        console.log("Lead status checked for logID: ", log?.LogID);
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }
);

async function checkLeadStatus(log: Logs) {
  const leadStatusAPI = process.env.SEARCHAUTOMATIONAPISTATUS as string;

  try {
    const checkStatus = async (): Promise<LeadStatusResponse | null> => {
      const maxTries = 1440;
      let tries = 0;
      let response: LeadStatusResponse | null = null;

      while (tries < maxTries) {
        const res = await fetch(leadStatusAPI, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ record_id: log.LogID }),
        });

        if (res.ok) {
          response = (await res.json()) as LeadStatusResponse;

          if (
            response.enrichment_status == "Completed" ||
            response.enrichment_status == "Failed" ||
            response.enrichment_status == "Cancelled"
          ) {
            return response;
          }

          tries++;
          await new Promise((r) => setTimeout(r, 1 * 60 * 1000));
        }

        tries++;
        await new Promise((r) => setTimeout(r, 1 * 60 * 1000));
      }
      const upLead = await updateLog(log.LogID, "Failed", "", 0);
      if (!upLead) {
        return null;
      }
      return null;
    };
    const response = await checkStatus();

    if (!response) {
      return;
    }

    if (
      response.enrichment_status == "Cancelled" ||
      response.enrichment_status == "Failed"
    ) {
      const upLead = await updateLog(
        log.LogID,
        response.enrichment_status,
        response.spreadsheet_url,
        response.enriched_records
      );
      if (!upLead) {
        return;
      }
      const state = await updateCredits(upLead.userID, upLead.creditsUsed);
      if (!state) {
        return;
      }

      console.log("Lead status failed for logID: ", log.LogID);
    }

    if (response.enrichment_status == "Completed") {
      const updateLead = await updateLog(
        log.LogID,
        response.enrichment_status,
        response.spreadsheet_url,
        response.enriched_records
      );

      if (!updateLead) {
        return;
      }

      console.log("Lead status completed for logID: ", log.LogID);
    }
  } catch (err: any) {
    const updateLead = await updateLog(log.LogID, "Failed", "", 0);
    if (!updateLead) {
      return;
    }
    return;
  }
}

app.post(
  "/editLogAdmin",
  adminVerification,
  async (req: Request, res: Response) => {
    try {
      const { logID, creditsUsed, status, apollo_link, url } = req.body;

      if (!logID || !status || !apollo_link) {
        res.status(400).json({ message: "Missing fields" });
        return;
      }

      const UpdateLogData = await editLog(
        logID,
        status,
        apollo_link,
        creditsUsed,
        url
      );

      if (!UpdateLogData) {
        res.status(400).json({ message: "Failed to update log" });
        return;
      }

      res
        .status(200)
        .json({ message: "Log updated successfully", log: UpdateLogData });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }
);

app.get(
  "/getAllBills",
  adminVerification,
  async (req: Request, res: Response) => {
    //TESTED
    try {
      const data = await getAllInvoices();
      if (!data) {
        throw new Error("no bills found");
      }
      res.status(200).json({ data });
    } catch (error: any) {
      res.status(404).json({ error: error.message });
    }
  }
);

app.post(
  "/getBillsByUser",
  adminVerification,
  async (req: Request, res: Response) => {
    //TESTED
    try {
      const { userID } = req.body;
      const data = await getAllLogsByUserID(userID);
      if (!data) {
        throw new Error("no bills found");
      }
      res.status(200).json({ data });
    } catch (error: any) {
      res.status(404).json({ error: error.message });
    }
  }
);

app.post("/getBill", adminVerification, async (req: Request, res: Response) => {
  //TESTED
  try {
    const { billingID } = req.body;
    const data = await getInvoiceByBillingID(billingID);
    if (!data) {
      throw new Error("no bill found");
    }
    res.status(200).json({ data });
  } catch (error: any) {
    res.status(404).json({ error: error.message });
  }
});

app.get(
  "/getUsageRanking",
  adminVerification,
  async (req: Request, res: Response) => {
    //TESTED
    try {
      const data = await getAllUsers();
      if (!data) {
        throw new Error("no logs found");
      }

      let ranking = data.sort(
        (a, b) => b.TotalCreditsUsed! - a.TotalCreditsUsed!
      );
      res.status(200).json({ ranking });
    } catch (error: any) {
      res.status(404).json({ error: error.message });
    }
  }
);

app.get(
  "/getAvailableTiers",
  adminVerification,
  async (req: Request, res: Response) => {
    try {
      const tiers = await getSubscriptionTiers();
      res.status(200).json({ tiers });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
);

app.post(
  "/refreshTiers",
  adminVerification,
  async (req: Request, res: Response) => {
    try {
      const tiers = await refreshTiers();
      res.status(200).json({
        message: "Tiers refreshed",
        count: Object.keys(tiers).length,
        tiers,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
);

app.get(
  "/getSubscriptionStats",
  adminVerification,
  async (req: Request, res: Response) => {
    try {
      const users = await getAllUsers();
      const activeSubscriptions = users.filter(
        (user) => user.subscriptionStatus === "active"
      );
      const canceledSubscriptions = users.filter(
        (user) => user.subscriptionStatus === "canceled"
      );
      const pastDueSubscriptions = users.filter(
        (user) => user.subscriptionStatus === "past_due"
      );

      const stats: {
        totalUsers: number;
        activeSubscriptions: number;
        canceledSubscriptions: number;
        pastDueSubscriptions: number;
        subscriptionsByTier: Record<string, number>;
        totalSubscriptionRevenue: number;
      } = {
        totalUsers: users.length,
        activeSubscriptions: activeSubscriptions.length,
        canceledSubscriptions: canceledSubscriptions.length,
        pastDueSubscriptions: pastDueSubscriptions.length,
        subscriptionsByTier: {},
        totalSubscriptionRevenue: 0,
      };

      const tiers = await getSubscriptionTiers();
      activeSubscriptions.forEach((user) => {
        if (user.subscriptionPlan) {
          const tierKey = user.subscriptionPlan;
          if (!stats.subscriptionsByTier[tierKey]) {
            stats.subscriptionsByTier[tierKey] = 0;
          }
          stats.subscriptionsByTier[tierKey]++;

          if (tiers[tierKey]) {
            stats.totalSubscriptionRevenue += tiers[tierKey].amount;
          }
        }
      });

      res.status(200).json({ stats });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
);

export default app;
