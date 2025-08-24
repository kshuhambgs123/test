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

      const search = req.query.search as string | undefined;

      const departments = await getDepartmentList(search);

      if (!departments || departments.length === 0) {
        res.status(404).json({ message: "No departments found" , department: [] });
        return;
      }

      const filteredDepartments = departments.map((dept) => {

        const deptName = dept.name.toLowerCase();
        const deptMatches = search ? deptName.includes(search) : true;

        const filteredChildren = dept.jobFunctions.filter((job: any) => {
            if (!search) return true;
            const regex = new RegExp(search, "i");
            return regex.test(job.name);       
        });

        const children =
          !search || deptMatches ? dept.jobFunctions : filteredChildren;

        return {
          id: dept.id,
          name: dept.name,
          children,
        };
      });

      res.status(200).json({ department : filteredDepartments });
    } catch (error: any) {
      console.error("Error fetching logs:", error);
      res.status(500).json({ message: error.message });
    }
  }
);

export default app;