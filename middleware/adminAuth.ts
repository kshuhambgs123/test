import { Request, Response, NextFunction } from "express";
import { adminAuth } from "../db/admindb";

const adminVerification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers["authorization"];
    if (!authHeader) {
      throw new Error("Authorization header missing");
    }

    const accessToken = authHeader.split("Bearer ")[1];
    if (!accessToken) {
      throw new Error("Token missing");
    }

    if (await adminAuth.has(accessToken)) {
      next();
    } else {
      throw new Error("Unauthorized");
    }
  } catch (error: any) {
    res.status(401).json({ message: error.message });
  }
};

export default adminVerification;
