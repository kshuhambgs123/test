// industry.ts
import dotenv from "dotenv";
import express, { Request, Response } from "express";
import { getIndustryList } from "../db/industry";
import verifySessionToken from "../middleware/supabaseAuth";
import { getUser } from "../db/user";
import { getTechnologyList } from "../db/technology";

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

      const technology = await getTechnologyList(search);

      if (!technology || technology.length === 0) {
        res.status(200).json({ message: "No technologies found" , technology: [] });
        return;
      }

      res.status(200).json({ technology });
    } catch (error: any) {
      console.error("Error fetching logs:", error);
      res.status(500).json({ message: error.message });
    }
  }
);

export default app;