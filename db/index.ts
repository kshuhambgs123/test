import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
dotenv.config();

const supabaseBaseUrl = process.env.SUPABASE_BASE_URL as string;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY as string;

const supabase = createClient(supabaseBaseUrl, supabaseAnonKey);

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default supabase;
export { prisma };
