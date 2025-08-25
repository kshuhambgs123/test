import { Technology } from "@prisma/client";
import { prisma } from "./index";

export async function getTechnologyList(search?: string): Promise<any[]> {
  try {
    const technology_list = await prisma.technology.findMany({
        where: search
         ? {
            display_name: {
              contains: search,
              mode: "insensitive",
            },
          }
         : undefined,
        select: {
        id: true,
        category: true,
        display_name: true,
    }});

    if (!technology_list) {
      return [];
    }
    return technology_list;
  } catch (error: any) {
    throw new Error(error.message);
  }
}
