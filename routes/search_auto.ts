// search_auto.ts

import { Logs } from "@prisma/client";
import dotenv from "dotenv";
import express, { Request, Response } from "express";
import formdata from "form-data";
import { updateCredits } from "../db/admin";
import { createLogOnly, updateLog } from "../db/log";
import { deductCredits } from "../db/subscription";
import { getUser } from "../db/user";
import { LeadStatusResponse } from "../types/interfaces";
import verifySessionToken from "../middleware/supabaseAuth";
import { request } from "http";
import { safeParse, z } from "zod";
import { getIndustryIds } from "../db/industry";
dotenv.config();

const app = express.Router();

function checkUrl(url: string): boolean {
  const basePattern = /^https:\/\/app\.apollo\.io\/#\/people\?/;

  const invalidPattern = /contactLabelIds\[\]=/;

  return basePattern.test(url) && !invalidPattern.test(url);
}

const searchSchema = z.object({
  page: z.number().min(1).default(1),
  per_page: z.number().min(1).max(100).default(100),
  person_titles: z.array(z.string()).optional(),
  include_similar_titles: z.boolean().optional(),
  person_not_titles: z.array(z.string()).optional(),
  person_locations: z.array(z.string()).optional(),
  person_seniorities: z.array(z.string()).optional(),
  person_department_or_subdepartments: z.array(z.string()).optional(),
  contact_email_status_v2: z.array(z.string()).optional(),
  organization_num_employees_ranges: z.array(z.string()).optional(),
  sort_ascending: z.boolean().optional(),
  sort_by_field: z.string().optional(),
  fields: z.array(z.string()).optional(),
  currently_using_any_of_technology_uids: z.array(z.string()).optional(),
  q_organization_domains_list: z.array(z.string()).optional(),
  organization_industry_display_name: z.array(z.string()).optional(),
}).passthrough();

async function handleRequest(body: any) {
  const parsedBody = searchSchema.parse(body);

  const organization_industry_display_names_list = parsedBody.organization_industry_display_name?.map(
    (item: string) => item.trim()
  ) ?? [];
  // console.log("industry names list: ", organization_industry_display_names_list);
  delete parsedBody.organization_industry_display_name;

  const organization_industry_tag_ids = organization_industry_display_names_list.length > 0 ? await getIndustryIds(organization_industry_display_names_list) : []
  return {
    cleanedBody: parsedBody,
    organization_industry_display_names_list: organization_industry_display_names_list,
    organization_industry_tag_ids: organization_industry_tag_ids.length > 0 ? organization_industry_tag_ids.map((item) => item.industry_id) : []
  };
}

app.post(
  "/search",
  verifySessionToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userID = (req as any).user.id;
      const user = await getUser(userID);

    //   const { apolloLink, noOfLeads, fileName } = req.body;

    //    if (!apolloLink || !noOfLeads || !fileName) {
    //     res.status(400).json({ message: "Missing required fields" });
    //     return;
    //   }

    //   const noOfLeadsNumeric = parseInt(noOfLeads);
    //   if (
    //     noOfLeadsNumeric <= 0
    //   ) {
    //     res.status(400).json({ message: "Invalid number of leads" });
    //     return;
    //   }
      
    //   const credits = noOfLeadsNumeric;

    if (!user) {
        res.status(404).json({ message: "User not found" });
        return;
    }
   
    const parsedBodySafe = searchSchema.safeParse(req.body)
    if (!parsedBodySafe.success) {
        res.status(400).json({
              message: "Invalid request body",
              errors: parsedBodySafe.error.format()
        });
        return;
    }
    // console.log("Parsed body: ", req.body.organization_industry_display_name);
    const body = await handleRequest(req.body);

      // Use hybrid credit system - check total available credits
    //   const userSubscriptionCredits = user.subscriptionCredits ?? 0;
    //   const totalAvailableCredits = userSubscriptionCredits + user.credits;
    //   if (totalAvailableCredits < credits) {
    //     res.status(400).json({
    //       message: "Insufficient credits",
    //       availableCredits: {
    //         subscriptionCredits: userSubscriptionCredits,
    //         purchasedCredits: user.credits,
    //         totalCredits: totalAvailableCredits,
    //       },
    //     });
    //     return;
    //   }

    //   const dns = process.env.DNS as string;

      const searchAPI = process.env.SAMPLESEARCHAUTOMATIONAPI as string;

      const response = await fetch(searchAPI, {
        method: "POST",
        // headers: {
        //   "Content-Type": "application/json",
        // },
        body: body.organization_industry_tag_ids.length > 0 ? JSON.stringify({...body.cleanedBody,
          organization_industry_tag_ids: body.organization_industry_tag_ids}) : JSON.stringify(body.cleanedBody),
      });

      if (!response.ok) {
        res.status(400).json({ message: "Failed to fetch" });
        return;
      }
      // console.log("Response received from search API", body.organization_industry_tag_ids.length, body.organization_industry_tag_ids, body.organization_industry_tag_ids.length > 0 ? JSON.stringify({...body.cleanedBody,
      //     organization_industry_tag_ids: body.organization_industry_tag_ids}) : JSON.stringify(body.cleanedBody));
      const data = await response.json();

    //   const deductionResult = await deductCredits(userID, credits);
    //   if (!deductionResult.success) {
    //     res.status(400).json({ message: "Failed to deduct credits" });
    //     return;
    //   }

    //   const newLog = await createLogOnly(
    //     data.record_id,
    //     userID,
    //     noOfLeadsNumeric,
    //     0,
    //     apolloLink,
    //     fileName,
    //     credits,
    //     "url",
    //     user.name,
    //     user.email
    //   );

      // Get updated user data to show current balances
    //   const updatedUser = await getUser(userID);
    //   if (!updatedUser) {
    //     res
    //       .status(400)
    //       .json({ message: "Failed to retrieve updated user data" });
    //     return;
    //   }

    //   let additionalInformation = "";
    //   if (userSubscriptionCredits >= credits) {
    //     additionalInformation = "Used subscription credits.";
    //   } else if (userSubscriptionCredits > 0) {
    //     additionalInformation = "Subscription Exhausted. Using bought credits.";
    //   } else {
    //     additionalInformation = "Used bought credits.";
    //   }

      res.status(200).json({
        message: `People fetched successfully`,
        // balance: {
        //   subscriptionCredits: updatedUser.subscriptionCredits ?? 0,
        //   purchasedCredits: updatedUser.credits,
        //   totalCredits:
        //     (updatedUser.subscriptionCredits ?? 0) + updatedUser.credits,
        // },
        // additional_information: additionalInformation,
        // log: newLog,
        data: data
      });

    //   setImmediate(async () => {
    //     console.log("Checking lead status for logID: ", newLog?.LogID);
    //     const resp = await checkLeadStatus(newLog as Logs);
    //     console.log("Lead status checked for logID: ", newLog?.LogID);
    //   });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
);

/*
async function checkLeadStatus(log: Logs) {
  const leadStatusAPI = process.env.SEARCHAUTOMATIONAPISTATUS as string;

  try {
    const checkStatus = async (): Promise<LeadStatusResponse | null> => {
      const maxTries = 1440;
      let tries = 0;
      let response: LeadStatusResponse | null = null;

      while (tries < maxTries) {
        const res = await fetch(leadStatusAPI, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ record_id: log.LogID }),
        });

        if (res.ok) {
          response = (await res.json()) as LeadStatusResponse;

          if (
            response.enrichment_status == "Completed" ||
            response.enrichment_status == "Failed" ||
            response.enrichment_status == "Cancelled"
          ) {
            return response;
          }

          tries++;
          await new Promise((r) => setTimeout(r, 1 * 60 * 1000));
        }

        tries++;
        await new Promise((r) => setTimeout(r, 1 * 60 * 1000));
      }
      const upLead = await updateLog(log.LogID, "Failed", "", 0);
      if (!upLead) {
        return null;
      }
      return null;
    };
    const response = await checkStatus();

    if (!response) {
      return;
    }

    if (
      response.enrichment_status == "Cancelled" ||
      response.enrichment_status == "Failed"
    ) {
      const upLead = await updateLog(
        log.LogID,
        response.enrichment_status,
        response.spreadsheet_url,
        response.enriched_records
      );
      if (!upLead) {
        return;
      }
      const state = await updateCredits(upLead.userID, upLead.creditsUsed);
      if (!state) {
        return;
      }

      console.log("Lead status failed for logID: ", log.LogID);
    }

    if (response.enrichment_status == "Completed") {
      const updateLead = await updateLog(
        log.LogID,
        response.enrichment_status,
        response.spreadsheet_url,
        response.enriched_records
      );

      if (!updateLead) {
        return;
      }

      console.log("Lead status completed for logID: ", log.LogID);
    }
  } catch (err: any) {
    const updateLead = await updateLog(log.LogID, "Failed", "", 0);
    if (!updateLead) {
      return;
    }
    return;
  }
}
*/

export default app;
