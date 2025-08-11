// server.ts
import express, { Request, Response } from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import routes from "./routes/index";

// Load environment-specific config
const envFile = process.env.NODE_ENV === "test" ? ".env.test" : ".env";
dotenv.config({ path: envFile });

const app = express();
app.use(cors());

app.use(
  "/api/payments/searchLeadsConfirmPayment",
  express.raw({ type: "application/json" })
);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use("/api", routes);

app.get("/health", async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({
    message: "server is healthy",
    environment: process.env.NODE_ENV || "development",
    database: process.env.DATABASE_URL ? "connected" : "not configured",
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
