import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import routes from "./routes/index";

const envFile = process.env.NODE_ENV === "test" ? ".env.test" : ".env";
dotenv.config({ path: envFile });

const app = express();
app.use(express.json()); 
app.use(cors());

app.use(
  "/api/payments/searchLeadsConfirmPayment",
  express.raw({ type: "application/json" })
);

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

// Catch 404 for unknown routes
app.use((req: Request, res: Response) => {
  res.status(404).json({
    status: "fail",
    message: "Route not found",
  });
});

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
