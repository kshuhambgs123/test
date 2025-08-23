import { Department, JobFunction } from "@prisma/client";
import { prisma } from "./index";

export async function getDepartmentList(): Promise<any[]> {
  try {
    const departments = await prisma.department.findMany({
      include: {
        jobFunctions: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!departments) {
      return [];
    }
    return departments;
  } catch (error: any) {
    throw new Error(error.message);
  }
}