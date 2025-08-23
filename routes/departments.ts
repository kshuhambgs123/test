// departments.ts
import dotenv from "dotenv";
import express, { Request, Response } from "express";
import verifySessionToken from "../middleware/supabaseAuth";
import { getUser } from "../db/user";
import { getDepartmentList } from "../db/department";

dotenv.config();

const app = express.Router();

app.get(
  "/job-functions",
  verifySessionToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userID = (req as any).user.id;
      const user = await getUser(userID);

      if (!user) {
        res.status(404).json({ message: "User not found" });
        return;
      }

    //   const search = req.query.search as string | undefined;

      const departments = await getDepartmentList();

      if (!departments || departments.length === 0) {
        res.status(404).json({ message: "No departments found" });
        return;
      }

      const department = departments.map((dept) => ({
        id: dept.id,
        name: dept.name,
        children: dept.jobFunctions,
       } ));

      res.status(200).json({ department });
    } catch (error: any) {
      console.error("Error fetching logs:", error);
      res.status(500).json({ message: error.message });
    }
  }
);

export default app;