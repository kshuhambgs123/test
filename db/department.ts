import { Department, JobFunction, Prisma } from "@prisma/client";
import { prisma } from "./index";

export async function getDepartmentList(search?: string): Promise<any[]> {
  try {
    const whereClause = search
      ? {
          OR: [
            {
              name: {
                contains: search,
                mode: Prisma.QueryMode.insensitive, 
              },
            },
            {
              jobFunctions: {
                some: {
                  name: {
                    contains: search,
                    mode: Prisma.QueryMode.insensitive,
                  },
                },
              },
            },
          ],
        }
      : {};
      const departments = await prisma.department.findMany({
      where: whereClause,
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