import dotenv from "dotenv";
import express, { Request, Response } from "express";
import { getOneLog } from "../db/log";
import verifySessionToken from "../middleware/supabaseAuth";
import { getLogsByUserID } from "../db/admin";
dotenv.config();

const app = express.Router();

app.get(
  "/getUserLogs",
  verifySessionToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userID = (req as any).user.id;
      const logs = await getLogsByUserID(userID);

      if (!logs || logs.length === 0) {
        res.status(200).json({ message: "No logs found for this user" });
        return;
      }

      res.status(200).json({ logs });
    } catch (error: any) {
      console.error("Error fetching logs:", error);
      res.status(500).json({ message: error.message });
    }
  }
);

app.post(
  "/getOneLog",
  verifySessionToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { logID } = req.body;
      if (!logID) {
       res.status(400).json({ message: "logID is required" });
       return;
      }
      const log = await getOneLog(logID);

      if (!log) {
        res.status(404).json({ message: "Log not found" });
        return;
      }

      res.status(200).json({ log });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
);

// app.post("/checkleadStatus", verifySessionToken, async (req: Request , res: Response): Promise<void> => {
//     try {
//         const { logID } = req.body;

//         const leadStatusAPI = process.env.SEARCHAUTOMATIONAPISTATUS as string;
//         const response = await fetch(leadStatusAPI,{
//             method: 'POST',
//             headers: {
//                 'Content-Type': 'application/json',
//             },
//             body: JSON.stringify({"record_id":logID}),
//         });

//         if (!response.ok) {
//             res.status(400).json({ message: "Failed to check lead status" });
//             return;
//         }

//         const data = await response.json();

//         if(data.enrichment_status == 'Cancelled' || data.enrichment_status == 'Failed'){
//             const log = await getOneLog(logID);
//             if (!log) {
//                 res.status(400).json({ message: "Failed to get log" });
//                 return;
//             }

//             if(log.status == 'Failed' || log.status == 'Cancelled'){
//                 res.status(400).json({ message: "Lead status already failed or cancelled credits already refunded" });
//                 return;
//             }

//             const upLead = await updateLog(logID,data.enrichment_status,data.spreadsheet_url,data.enriched_records);
//             if (!upLead) {
//                 res.status(400).json({ message: "Failed to update log" });
//                 return;
//             }
//             const state = await updateCredits(upLead.userID, upLead.creditsUsed)
//             if (!state) {
//                 res.status(400).json({ message: "Failed to update credits" });
//                 return;
//             }

//             res.status(200).json({ message: "lead status failed or cancelled credits refunded", credits: (state as User).credits });
//             return;

//         }

//         if( data.enrichment_status == 'Completed'){
//             const updateLead = await updateLog(logID,data.enrichment_status,data.spreadsheet_url,data.enriched_records);

//             if (!updateLead) {
//                 res.status(400).json({ message: "Failed to update log" });
//                 return;
//             }

//             res.status(200).json({ message: `Lead status checked successfully`,log:updateLead });
//         }
//         if( data.enrichment_status == 'Inqueue' || data.enrichment_status == 'Inprogress'){
//             const updateLead = await updateLog(logID,data.enrichment_status,data.spreadsheet_url,data.enriched_records);

//             if (!updateLead) {
//                 res.status(400).json({ message: "Failed to update log" });
//                 return;
//             }

//             res.status(200).json({ message: `Lead status checked successfully`,log:updateLead });
//         }

//     } catch (error: any) {
//         res.status(500).json({ message: error.message });
//     }
// })

export default app;
