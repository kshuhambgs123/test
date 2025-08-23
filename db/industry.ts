import { Industry } from "@prisma/client";
import { prisma } from "./index";

export async function getIndustryList(): Promise<any[]> {
  try {
    const industry = await prisma.industry.findMany({ select: {
        id: true,
        display_name: true,
    }});

    if (!industry) {
      return [];
    }
    return industry;
  } catch (error: any) {
    throw new Error(error.message);
  }
}

export async function getIndustryIds(parameter : any): Promise<any[]> {
  try {
    const industry = await prisma.industry.findMany({
      where: {
        display_name: {
          in: parameter?.map((name: string) => name.trim()) || []
        }
      },
      select: {
        industry_id: true
      }
    });

    if (!industry) {
      return [];
    }
    console.log("industry ids: ", industry);
    return industry;
  } catch (error: any) {
    throw new Error(error.message);
  }
}