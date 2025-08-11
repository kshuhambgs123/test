import { NextFunction, Response } from "express";
import { AuthenticatedRequest } from "../types/interfaces";
import { prisma } from "../db/index";

const apiAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers["authorization"];
    if (!authHeader) {
      throw new Error("Authorization header missing");
    }

    const APIKEY = authHeader.split("Bearer ")[1];
    if (!APIKEY) {
      throw new Error("Token missing");
    }

    const user = await prisma.user.findUnique({
      where: {
        apikey: APIKEY,
      },
    });

    if (user?.apikey) {
      req.user = user;
      next();
    } else {
      throw new Error("Unauthorized");
    }
  } catch (error: any) {
    res.status(401).json({ message: error.message });
  }
};

export default apiAuth;
