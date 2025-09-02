import { LatestFundingStageFacet } from "@prisma/client";
import { prisma } from "./index";

export async function getFundingList(): Promise<any[]> {
  try {
    const funding = await prisma.latestFundingStageFacet.findMany({
        select: {
        id: true,
        display_name: true,
    }});

    if (!funding) {
      return [];
    }
    return funding;
  } catch (error: any) {
    throw new Error(error.message);
  }
}

export async function getFundingValues(parameter : any): Promise<any[]> {
  try {
    const funding = await prisma.latestFundingStageFacet.findMany({
      where: {
        display_name: {
          in: parameter?.map((name: string) => name.trim()) || []
        }
      },
      select: {
        value: true
      }
    });

    if (!funding) {
      return [];
    }
    return funding.map(f => String(f.value));
  } catch (error: any) {
    throw new Error(error.message);
  }
}