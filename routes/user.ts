// user.ts

import dotenv from "dotenv";
import express, { Request, Response } from "express";
import { createUser, getHeardFromStats, getUser, refreshAPIKey } from "../db/user";
import verifySessionToken from "../middleware/supabaseAuth";
import { stripeClient } from "../payments/stripe";
import { prisma } from "../db/index";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

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

app.get(
  "/getCurrencyRate",
  verifySessionToken,
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

app.get(
  "/renewSubscription",
  verifySessionToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userID = (req as any).user.id;

      const user = await getUser(userID);

      if (!user) {
        res.status(404).json({ message: "User not found" });
        return;
      }
      
      if (!user.stripeCustomerId || !user.stripeSubscriptionId) {
            res.status(200).json({
              hasActiveSubscription: false,
              message: "No active subscription found",
            });
            return;
      }
      
      const subscription = await stripeClient.subscriptions.retrieve(
            user.stripeSubscriptionId,
      );

      if (!subscription) {
          res.status(200).json({
            hasActiveSubscription: false,   
            message: "No active subscription found",                        
          });
          return;
      }

      if (subscription.status === 'active') {
        if (subscription.cancel_at_period_end) {
          // Resume it
          await stripeClient.subscriptions.update(user.stripeSubscriptionId, {
            cancel_at_period_end: false,
          });

          await prisma.user.update({
            where: { UserID: userID },
            data: {
              subscriptionStatus: 'active',
            },
          });

          res.status(200).json({
            hasActiveSubscription: true,
            message: 'Subscription resumed successfully',
          });
          return;
        }

        res.status(200).json({
          hasActiveSubscription: true,
          message: 'Subscription is already active',
        });
        return;
      }
      res.status(200).json({ hasActiveSubscription: true, message: "Subscription is already active"});
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
);

app.get(
  "/heard-from",
  // verifySessionToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      // const userID = (req as any).user.id;
      // const user = await getUser(userID);

      // if (!user) {
      //   res.status(404).json({ message: "User not found" });
      //   return;
      // }

      const resp = await getHeardFromStats();
   
     if (!resp || resp.length === 0) {
        res.status(200).json([]); 
      } else {
        res.status(200).json(
          resp.map(row => ({
            heardFrom: row.heardFrom,
            count: Number(row.count),
          }))
        );
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
);

export default app;
