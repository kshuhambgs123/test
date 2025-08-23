// user.ts

import dotenv from "dotenv";
import express, { Request, Response } from "express";
import { createUser, getUser, refreshAPIKey } from "../db/user";
import verifySessionToken from "../middleware/supabaseAuth";
dotenv.config();

const app = express.Router();

app.post(
  "/register",
  verifySessionToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userID = (req as any).user.id;
      const email = (req as any).user.email;
      const { fullName, companyName, phoneNumber, location, heardFrom } =
        req.body;

      // First, check if user already exists
      const existingUser = await getUser(userID);

      if (existingUser) {
        res.status(409).json({ message: "User already exists" });
        return;
      }

      const credits = process.env.RegistrationCredits as string;
      const searchCredits = process.env.Searchcredits as string;
      const user = await createUser(
        fullName,
        companyName,
        phoneNumber,
        location,
        userID,
        email,
        parseFloat(credits),
        0,
        heardFrom,
        parseFloat(searchCredits)
      );
      if (!user) {
        res.status(500).json({ message: "Failed to create user" });
        return;
      }

      res.status(201).json({ message: "User created successfully", user });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
);

app.get(
  "/refreshAPIkey",
  verifySessionToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userID = (req as any).user.id;
      const newAPIkey = await refreshAPIKey(userID);

      if (!newAPIkey) {
        res.status(400).json({ message: "Failed to update API key" });
        return;
      }

      res
        .status(200)
        .json({ message: "API key updated successfully", newAPIkey });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
);

app.get(
  "/getUser",
  verifySessionToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userID = (req as any).user.id;
      const user = await getUser(userID);

      if (!user) {
        res.status(404).json({ message: "User not found" });
        return;
      }

      res.status(200).json({ user });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
);

app.get(
  "/getCredits",
  verifySessionToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userID = (req as any).user.id;
      const user = await getUser(userID);

      if (!user) {
        res.status(404).json({ message: "User not found" });
        return;
      }

      const userSubscriptionCredits = user.subscriptionCredits ?? 0;
      const totalCredits = userSubscriptionCredits + user.credits;

      let subscriptionInfo = null;
      if (user.subscriptionStatus === "active" && user.subscriptionPlan) {
        subscriptionInfo = {
          status: user.subscriptionStatus,
          plan: user.subscriptionPlan,
          currentPeriodEnd: user.subscriptionCurrentPeriodEnd,
          creditsRemaining: user.subscriptionCredits,
        };
      }

      res.status(200).json({
        credits: {
          subscriptionCredits: userSubscriptionCredits,
          purchasedCredits: user.credits,
          totalCredits: totalCredits,
        },
        subscriptionInfo: subscriptionInfo,
        totalBalance: totalCredits,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
);

app.get(
  "/getCost",
  verifySessionToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const costPerLead = parseFloat(process.env.COSTPERLEAD as string);
      res.status(200).json({ costPerLead });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
);

export default app;
