// admin.ts

import { LogsV2, Logs } from "@prisma/client";
import express, { Request, Response } from "express";
import axios from "axios";
import fs from "fs";
import path from "path";
import { v4 } from "uuid";
import {} from "../";
import {
  adminLogin,
  editLog,
  editLogV1,
  generateAPIkey,
  getAllApikeys,
  getAllUsers,
  getAllUsersWithFutureSubscription,
  getApiKey,
  getLogsByUserID,
  getUserById,
  revokeAPIkey,
  tokenVerify,
  updateCredits,
  updateCreditsForOneAmongAll,
} from "../db/admin";
import { getAllInvoices, getInvoiceByBillingID } from "../db/billing";
import {
  createCompleteLog,
  getAllLogs,
  getAllLogsByUserID,
  getAllUsersSearchLogs,
  getAllV1Logs,
  getOneLog,
  getOneLogV1,
  updateLog,
  updateLogV1,
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
  ChangeMaintenanceRequest,
  ChangeCurrencyRateRequest,
} from "../types/interfaces";
import { stripeClient } from "../payments/stripe";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const app = express.Router();

// Login route
app.post("/login", async (req: LoginRequest, res: Response) => {
  //TESTED
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ message: "Email and password are required." });
      return;
    }
    const resp = await adminLogin(email, password);
    if (!resp) {
      throw new Error("No admin account");
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
    if (!token) {
      res.status(400).json({ message: "Token is required." });
      return;
    }

    const resp = await tokenVerify(token);
    if (!resp) {
      throw new Error("Invalid token");
    }

    res.status(200).json({ message: "Authorized" });
  } catch (error: any) {
    res.status(404).json({ message: error.message });
  }
});

// Get price
app.get("/getPrice", adminVerification, async (req: Request, res: Response) => {
  //TESTED
  try {
    if (!process.env.COSTPERLEAD) {
      throw new Error("Price not set.");
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
       if (typeof newPrice !== "number" || isNaN(newPrice) || newPrice <= 0) {
        throw new Error("Invalid price value.");
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

      res.status(200).json({ resp: "Price updated." });
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
      if (!automationLink || automationLink.trim() === "") {
        throw new Error("Invalid automation link.");
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

      res.status(200).json({ resp: "Automation link updated." });
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
      if (!statusLink || statusLink.trim() === "") {
        throw new Error("Invalid status link.");
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

      res.status(200).json({ resp: "Automation status link updated." });
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
      if (!newDNS || newDNS.trim() === "") {
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

      res.status(200).json({ resp: "Automation link updated." });
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
      let resp = await getAllUsersWithFutureSubscription();
      for (const user of resp) {
        if (user.stripeSubscriptionId) {
          const subscription = await stripeClient.subscriptions.retrieve(
                user.stripeSubscriptionId,
          );
          // const status = subscription.status;
          const cancelAtPeriodEnd = subscription.cancel_at_period_end;
          user.cancel_at_period_end_flag = cancelAtPeriodEnd; 
        } else {
           user.cancel_at_period_end_flag = ''; 
        }
      }
      // console.log("Users fetched:", resp.length, resp[0]);
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
      if (!userID) {
       res.status(400).json({ message: "UserID is required." });
       return;
      }
      const resp = await generateAPIkey(userID);
      if (!resp) {
        throw new Error("Failed to generate API key.");
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
      if (!userID) {
       res.status(400).json({ message: "UserID is required." });
       return;
      }
      const resp = await getApiKey(userID);
      if (!resp) {
        throw new Error("API key not found for this user.");
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
      if (!userID) {
       res.status(400).json({ message: "UserID is required." });
       return;
      }
      const resp = await revokeAPIkey(userID);
      if (!resp) {
        throw new Error("Failed to revoke API key.");
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
      const { userID, credits , type} = req.body;

      // const resp = await updateCredits(userID, credits);
      // const resp = await updateCredits(userID, credits);
      const resp = await updateCreditsForOneAmongAll(userID, credits, type);
      if (resp === "negative") {
        throw new Error("Credits cannot be negative");
      }
      if (!resp) {
        throw new Error("Failed to update credits");
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
    if (!userID) {
      res.status(400).json({ message: "UserID is required." });
      return;
    }
    const data = await getUserById(userID);
    if (!data) {
      throw new Error("User not found");
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
      if (!userID) {
        res.status(400).json({ message: "UserID is required." });
        return;
      }
      const data = await getLogsByUserID(userID);
      if (!data) {
        throw new Error("Logs not found.");
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
        throw new Error("Logs not found");
      }
      res.status(200).json({ data });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }
);

app.get("/getAllV1Logs", adminVerification, async (req: Request, res: Response) => {  //TESTED
    try {
        const data = await getAllV1Logs()

        if (!data) {
            throw new Error("failed to find logs");
        }
        res.status(200).json({ data });
    } catch (error: any) {
        res.status(400).json({ "message": error.message });
    }
});

app.post(
  "/changeRegistrationCredits",
  adminVerification,
  async (req: ChangeEnrichPriceRequest, res: Response) => {
    //TESTED
    try {
      const { newPrice } = req.body;
      if (isNaN(newPrice) || !newPrice) {
        throw new Error("Invalid credit value");
      }

      process.env.RegistrationCredits = newPrice.toString();

      const envFilePath = path.resolve(__dirname, "../.env");
      if (!fs.existsSync(envFilePath)) {
        throw new Error(".env file not found");
      }

      let envFileContent = fs.readFileSync(envFilePath, "utf8");
      const newEnvFileContent = envFileContent.replace(
        /(^|\n)RegistrationCredits=.*/,
        `$1RegistrationCredits=${newPrice}`
      );
      fs.writeFileSync(envFilePath, newEnvFileContent);

      res.status(200).json({ resp: "Updated registration credits" });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

app.post(
  "/changeSearchcredits",
  adminVerification,
  async (req: ChangeEnrichPriceRequest, res: Response) => {
    try {
      const { newPrice } = req.body;
      if (isNaN(newPrice) || !newPrice) {
        throw new Error("Invalid credit value");
      }

      process.env.Searchcredits = newPrice.toString();
      
      const envFilePath = path.resolve(__dirname, "../.env");
      if (!fs.existsSync(envFilePath)) {
        throw new Error(".env file not found");
      }

      let envFileContent = fs.readFileSync(envFilePath, "utf8");
      const newEnvFileContent = envFileContent.replace(
        /(^|\n)Searchcredits=.*/,
        `$1Searchcredits= ${newPrice}`
      );
      fs.writeFileSync(envFilePath, newEnvFileContent);

      res.status(200).json({ resp: "Updated searchcredits credits" });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

app.get(
  "/getPercentageSearchCredits",
  adminVerification,
  async (req: Request, res: Response) => {
    try {
      if (!process.env.PERCENTAGE) {
        throw new Error("No search credit percentage set");
      }
      res.status(200).json({ resp: process.env.PERCENTAGE });
    } catch (error: any) {
      res.status(404).json({ error: error.message });
    }
  }
);

app.post(
  "/changePercentageSearchCredits",
  adminVerification,
  async (req: ChangeEnrichPriceRequest, res: Response) => {
    try {
      const { newPrice } = req.body;
      if (isNaN(newPrice) || !newPrice) {
        throw new Error("Invalid percentage value");
      }

      process.env.PERCENTAGE = newPrice.toString();
      
      const envFilePath = path.resolve(__dirname, "../.env");
      if (!fs.existsSync(envFilePath)) {
        throw new Error(".env file not found");
      }

      let envFileContent = fs.readFileSync(envFilePath, "utf8");
      const newEnvFileContent = envFileContent.replace(
        /(^|\n)PERCENTAGE=.*/,
        `$1PERCENTAGE= ${newPrice}`
      );
      fs.writeFileSync(envFilePath, newEnvFileContent);

      res.status(200).json({ resp: "Updated search credit percentage" });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

app.get(
  "/getCurrencyRate",
  adminVerification,
  async (req: Request, res: Response) => {
    try {
      if (!process.env.USD_RATE || !process.env.INR_RATE || !process.env.GBP_RATE || !process.env.EUR_RATE) {
        throw new Error("One or more currency rates are not set");
      }

      res.status(200).json({
        usd: parseFloat(process.env.USD_RATE),
        inr: parseFloat(process.env.INR_RATE),
        gbp: parseFloat(process.env.GBP_RATE),
        eur: parseFloat(process.env.EUR_RATE),
      });

    } catch (error: any) {
      res.status(404).json({ error: error.message });
    }
  }
);

app.post(
  "/changeCurrencyRate",
  adminVerification,
  async (req: ChangeCurrencyRateRequest, res: Response) => {
    try {
      const { usd, inr, gbp, eur } = req.body;
      if ([usd, inr, gbp, eur].some(val => isNaN(val) || val === null || val === undefined || val <= 0)) {
        throw new Error("Invalid currency rate");
      }
      // console.log("Received rates:", { usd, inr, gbp, eur });
      const envFilePath = path.resolve(__dirname, "../.env");

      if (!fs.existsSync(envFilePath)) {
        throw new Error(".env file not found");
      }

      let envFileContent = fs.readFileSync(envFilePath, "utf8");

      const currencyRates = {
        USD_RATE: usd,
        INR_RATE: inr,
        GBP_RATE: gbp,
        EUR_RATE: eur,
      };

      let newEnvFileContent = envFileContent;
      for (const [key, value] of Object.entries(currencyRates)) {
        const regex = new RegExp(`(^|\\n)${key}=.*`, "g");

        if (envFileContent.match(regex)) {
          // If key exists, replace it
          newEnvFileContent = envFileContent.replace(regex, `$1${key}=${value}`);
        } else {
          // If key doesn't exist, append it
          newEnvFileContent += `\n${key}=${value}`;
        }

        // Also update process.env
        process.env[key] = value.toString();
      }

      fs.writeFileSync(envFilePath, newEnvFileContent);

      res.status(200).json({ resp: "Updated search credit percentage" });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

app.get(
  "/refreshCurrencyRate",
  adminVerification,
  async (req: ChangeCurrencyRateRequest, res: Response) => {
    try {
      const appId = "2f11dc065ce04ce1b7c9cf7ce1ceea8f";
      const symbols = ["INR", "GBP", "EUR"].join(",");
      const url = `https://openexchangerates.org/api/latest.json?app_id=${appId}&symbols=${symbols}`;

      const response = await axios.get(url);

      if (response.status !== 200 || !response.data || !response.data.rates) {
        throw new Error("Invalid response from currency API");
      }

      const rates = response.data.rates;

      // Verify presence and validity of rates
      const { INR, GBP, EUR } = rates;
      if (
        typeof INR !== "number" ||
        typeof GBP !== "number" ||
        typeof EUR !== "number"
      ) {
        throw new Error("Missing or invalid currency rates in API response");
      }

      // Validate correctness of rates
      if (
        INR <= 0 || INR > 200 ||
        GBP <= 0 || GBP > 2 ||
        EUR <= 0 || EUR > 2
      ) {
        throw new Error("One or more currency rates are outside reasonable bounds");
      }

      const fetchedRates = {
        USD_RATE: 1,
        INR_RATE: INR,
        GBP_RATE: GBP,
        EUR_RATE: EUR,
      };

      // console.log("Fetched rates:", fetchedRates);

      const envFilePath = path.resolve(__dirname, "../.env");

      if (!fs.existsSync(envFilePath)) {
        throw new Error(".env file not found");
      }

      let envFileContent = fs.readFileSync(envFilePath, "utf8");
      let newEnvFileContent = envFileContent;

      const changedRates: Record<string,  number > = {};
      for (const [key, newValue] of Object.entries(fetchedRates)) {
        const regex = new RegExp(`(^|\\n)${key}\\s*=\\s*([^\\n]*)`);
        if (regex.test(newEnvFileContent)) {
          newEnvFileContent = envFileContent.replace(regex, `$1${key}=${newValue}`);
        } else {
          newEnvFileContent += `\n${key}=${newValue}`;
        }

        process.env[key] = newValue.toString();

        changedRates[key] = newValue;
      }

      fs.writeFileSync(envFilePath, newEnvFileContent.trim() + "\n", "utf8");

      res.status(200).json({
        message: "Currency rates refreshed successfully.",
        fetchedRates,
        changedRates,
      });
    } catch (error: any) {
      console.error("❌ Failed to refresh currency rates:", error.message);
      res.status(500).json({ error: error.message });
    }
  }
);

app.post(
  "/changeMaintenanceMode",
  // adminVerification,
  async (req: ChangeMaintenanceRequest, res: Response) => {
    try {
      const { mode } = req.body;
      if (!mode) {
        throw new Error("Invalid maintenance mode");
      }

      if (mode !== "true" && mode !== "false") {
        throw new Error("Maintenance mode must be 'true' or 'false'");
      }

      process.env.MaintenanceMode  = mode.toString();
      
      const envFilePath = path.resolve(__dirname, "../.env");
      // if (!fs.existsSync(envFilePath)) {
      //   throw new Error(".env file not found");
      // }

      let envFileContent = fs.readFileSync(envFilePath, "utf8");
      const newEnvFileContent = envFileContent.replace(
        /(^|\n)MaintenanceMode =.*/,
        `$1MaintenanceMode = ${mode}`
      );
      fs.writeFileSync(envFilePath, newEnvFileContent);

      res.status(200).json({ resp: "Updated maintenance mode " });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

app.get(
  "/getMaintenanceMode",
  async (req: Request, res: Response) => {
    try {
    if (!process.env.MaintenanceMode ) {
        throw new Error("Maintenance Mode not set.");
      }
      res.status(200).json({ resp: process.env.MaintenanceMode  });
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
        throw new Error("No registration credit set");
      }
      res.status(200).json({ resp: process.env.RegistrationCredits });
    } catch (error: any) {
      res.status(404).json({ error: error.message });
    }
  }
);

app.get(
  "/getSearchcredits",
  adminVerification,
  async (req: Request, res: Response) => {
    try {
      if (!process.env.Searchcredits) {
        throw new Error("No search credit set");
      }
      res.status(200).json({ resp: process.env.Searchcredits });
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
        valid_email_count
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
        res.status(400).json({ message: "Missing required fields" });
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
        status,
        parseInt(valid_email_count)
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

      if (!logID) {
        res.status(400).json({ message: "logID is required" });
        return;
      }

      const log = await getOneLogV1(logID);

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
      const upLead = await updateLogV1(log.LogID, "Failed", "", 0);
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
      const upLead = await updateLogV1(
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
      const updateLead = await updateLogV1(
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
    const updateLead = await updateLogV1(log.LogID, "Failed", "", 0);
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
      const { logID, creditsUsed, status, apollo_link, url , valid_email_count } = req.body;

      if (!logID || !status || !apollo_link) {
        res.status(400).json({ message: "Missing required fields" });
        return;
      }

      const UpdateLogData = await editLog(
        logID,
        status,
        apollo_link,
        creditsUsed,
        url,
        parseInt(valid_email_count)
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

//
app.post("/editV1LogAdmin", adminVerification, async (req: Request, res: Response) => {
    try {
        const { logID, creditsUsed, status, apollo_link, url} = req.body;

        if (!logID || !status || !apollo_link) {
            res.status(400).json({ message: "Missing fields" });
            return;
        }

        const UpdateLogData = await editLogV1(logID, status, apollo_link, creditsUsed, url);

        if (!UpdateLogData) {
            res.status(400).json({ message: "Failed to update v1 log" });
            return;
        }

        res.status(200).json({ message: "V1 Log updated successfully", log: UpdateLogData });
    } catch (error: any) {
        res.status(400).json({ "message": error.message });
    }
})

app.get(
  "/getAllBills",
  adminVerification,
  async (req: Request, res: Response) => {
    //TESTED
    try {
      const data = await getAllInvoices();
      if (!data) {
        throw new Error("No bills found");
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
        throw new Error("No bills found");
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
      throw new Error("No bill found");
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
        throw new Error("No logs found");
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

app.get(
  "/getAllUsersSearchLog",
  adminVerification,
  async (req: Request, res: Response) => {
    //TESTED
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 10;

      const resp = await getAllUsersSearchLogs(page, pageSize);

      res.status(200).json(resp);
    } catch (error: any) {
      res.status(404).json({ message: error.message });
    }
  }
);

export default app;
