// industry.ts
import dotenv from "dotenv";
import express, { Request, Response } from "express";
import { getIndustryList } from "../db/industry";
import verifySessionToken from "../middleware/supabaseAuth";
import { getUser } from "../db/user";

dotenv.config();

const app = express.Router();

app.get(
  "/dropdown",
  verifySessionToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userID = (req as any).user.id; 
      const user = await getUser(userID);

      if (!user) {
        res.status(404).json({ message: "User not found" });
        return;
      }

      const search = req.query.search as string | undefined;

      const industry = await getIndustryList(search);

      if (!industry || industry.length === 0) {
        res.status(404).json({ message: "No industries found" , industry: [] });
        return;
      }

      res.status(200).json({ industry });
    } catch (error: any) {
      console.error("Error fetching logs:", error);
      res.status(500).json({ message: error.message });
    }
  }
);

export default app;