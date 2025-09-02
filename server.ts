import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import routes from "./routes/index";
import { updateLogByWebhook } from "./db/log";
import { updateCreditsRefunded } from "./db/admin";

const envFile = process.env.NODE_ENV === "test" ? ".env.test" : ".env";
dotenv.config({ path: envFile });

const app = express();

app.use(
  "/api/payments/searchLeadsConfirmPayment",
  express.raw({ type: "application/json" })
);

app.use(express.json()); 
app.use(cors());

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use("/api", routes);

// Health endpoint
app.get("/health", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.status(200).json({
      message: "server is healthy",
      environment: process.env.NODE_ENV || "development",
      database: process.env.DATABASE_URL ? "connected" : "not configured",
    });
  } catch (error) {
    next(error); // forward error to error handler
  }
});


app.post('/webhook',async (req, res) => {
    console.log('🔔 Webhook received:');
    const { log_id , leads_count} = req.body;

    console.log('📌 client_id:', log_id);
    // console.log('📦 Other data:', rest);

      // We charge 1 credit per valid email, and +2 for each personal mobile if available
     const validEmails = req.body.valid_email_count ?? 0;
     const mobilesFound = req.body.personal_mobiles_found ?? 0;
     const creditsUsed = validEmails + mobilesFound * 2;


     if (
        req.body.status == "completed" 
      ) {
        const logsExport = await updateLogByWebhook(
          log_id,
          req.body.status,
          req.body.google_sheet,
          parseInt(req.body.valid_email_count),
          parseInt(req.body.number_of_leads_found),
          parseInt(creditsUsed)
        );
        if (!logsExport) {
          return;
        }

        // const reservedCredits = creditsUsed; //  parseFloat(req.body.leads_count);
        // console.log("Reserved credits:", reservedCredits);
        // console.log("Credits used:", creditsUsed);
        // Refund any unused credits
        const creditsToDeductOnly = creditsUsed ?? 0;

        if (creditsToDeductOnly > 0) {
          const refundState = await updateCreditsRefunded(logsExport.userID, creditsToDeductOnly, log_id);
          if (!refundState) {
            console.error("❌ Failed to refund credits for user:", logsExport.userID);
            // return res.status(500).send("Refund failed");
          }
        }
    }
    res.status(200).send('✅ Webhook received');
});

// Catch 404 for unknown routes
app.use((req: Request, res: Response) => {
  res.status(404).json({
    status: "fail",
    message: "Route not found",
  });
});

//
// Global error handling middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error("Global error handler:", err);

  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  res.status(statusCode).json({
    status: "error",
    message,
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(
    `Server is running on port ${PORT} in ${
      process.env.NODE_ENV || "development"
    } mode`
  );
});
