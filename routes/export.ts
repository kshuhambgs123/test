// export.ts

import { LogsV2, User } from "@prisma/client";
import dotenv from "dotenv";
import express, { Request, Response } from "express";
import formdata from "form-data";
import { updateCredits } from "../db/admin";
import { createLogOnly, getOneLog, updateLog } from "../db/log";
import { deductCredits } from "../db/subscription";
import { getUser } from "../db/user";
import apiauth from "../middleware/apiAuth";
import { LeadStatusResponse } from "../types/interfaces";
import { v4 } from "uuid";
import axios from "axios";
import verifySessionToken from "../middleware/supabaseAuth";
import { safeParse, z } from "zod";
import { getIndustryIds } from "../db/industry";
import { getFundingValues } from "../db/funding";
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
  organization_industry_not_display_name: z.array(z.string()).optional(),
  organization_locations: z.array(z.string()).optional(),
  Organization_latest_funding_stage_name: z.array(z.string()).optional(),
}).passthrough();

async function handleRequest(body: any) {
  const parsedBody = searchSchema.parse(body);
  
  const organization_industry_display_names_list = parsedBody.organization_industry_display_name?.map(
    (item: string) => item.trim()
  ) ?? [];
  // console.log("industry names list: ", organization_industry_display_names_list);
  delete parsedBody.organization_industry_display_name;

  const organization_industry_tag_ids = organization_industry_display_names_list.length > 0 ? await getIndustryIds(organization_industry_display_names_list) : [];

  const organization_latest_funding_stage_name_list = parsedBody.Organization_latest_funding_stage_name?.map(
    (item: string) => item.trim()
  ) ?? [];
  // console.log("organization_latest_funding_stage_name_list : ", organization_latest_funding_stage_name_list);
  delete parsedBody.Organization_latest_funding_stage_name;
  
  const organization_industry_display_code = organization_latest_funding_stage_name_list.length > 0 ? await getFundingValues(organization_latest_funding_stage_name_list) : [];

  const organization_industry_not_display_names_list = parsedBody.organization_industry_not_display_name?.map(
    (item: string) => item.trim()
  ) ?? [];
  // console.log("industry names list to exclude : ", organization_industry_not_display_names_list);
  delete parsedBody.organization_industry_not_display_name;
  
  const organization_not_industry_tag_ids = organization_industry_not_display_names_list.length > 0 ? await getIndustryIds(organization_industry_not_display_names_list) : [];
  return {
    cleanedBody: parsedBody,
    organization_industry_display_names_list: organization_industry_display_names_list,
    organization_industry_tag_ids: organization_industry_tag_ids.length > 0 ? organization_industry_tag_ids.map((item) => item.industry_id) : [],
    organization_not_industry_tag_ids: organization_not_industry_tag_ids.length > 0 ? organization_not_industry_tag_ids.map((item) => item.industry_id) : [],
    Organization_latest_funding_stage_cd: organization_industry_display_code.length > 0 ? organization_industry_display_code : [],  
  };
}

app.post(
  "/create",
  // apiauth,
   verifySessionToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userID = (req as any).user.id;
      const user = await getUser(userID);
      console.log("User:came ");
      const { filter, noOfLeads, fileName } = req.body;

      const body = await handleRequest(filter);
      
      const finalBodyFilter = { ...body.cleanedBody, organization_industry_tag_ids: body.organization_industry_tag_ids , organization_not_industry_tag_ids: body.organization_not_industry_tag_ids, Organization_latest_funding_stage_cd: body.Organization_latest_funding_stage_cd};
      
      if (!filter || !noOfLeads || !fileName) {
        res.status(400).json({ message: "Missing required fields" });
        return;
      }

      const noOfLeadsNumeric = parseInt(noOfLeads);
  
      if (
        noOfLeadsNumeric <= 0
      ) {
        res.status(400).json({ message: "Invalid number of leads" });
        return;
      }

      if (
        noOfLeadsNumeric < 100 ||
        noOfLeadsNumeric > 50000 
        // || noOfLeadsNumeric % 1000 !== 0
      ) {
        res.status(400).json({ message: "Invalid number of leads" });
        return;
      }

      let credits = noOfLeadsNumeric;

      if (!user) {
        res.status(404).json({ message: "User not found" });
        return;
      }

      const userSubscriptionCredits = user.subscriptionCredits ?? 0;
      const totalAvailableCredits = userSubscriptionCredits + user.credits;
      // console.log("Total available credits:", totalAvailableCredits , "Credits needed:", credits,  userSubscriptionCredits ); 
      if (totalAvailableCredits < credits) {
        res.status(400).json({
          message: "Insufficient credits",
          availableCredits: {
            subscriptionCredits: userSubscriptionCredits,
            purchasedCredits: user.credits,
            totalCredits: totalAvailableCredits,
          },
        });
        return;
      }

      const newLog = await createLogOnly(
        v4(),
        userID,
        noOfLeadsNumeric,
        0,
        JSON.stringify(filter),
        fileName,
        credits,
        "url",
        user.name,
        user.email
      );

      console.log("New log created:", newLog);

      if (!newLog) {
        res.status(500).json({ message: "Failed to create log" });
        return;
      } 

      const searchAPI = process.env.EXPORT_WEBHOOK_URL as string;
      console.log("sent data to webhook export");

      const extraFields: any = {};

      if (newLog) extraFields.log_id = newLog.LogID;
      if (req.body.noOfLeadsNumeric) extraFields.number_of_leads_found = req.body.number_of_leads_found;
      if (req.body.fileName) extraFields.file = req.body.fileName;
      if (noOfLeadsNumeric) extraFields.leads_count = noOfLeadsNumeric;
      if(user.email) extraFields.email = user.email;
      else extraFields.email = "";
      
      // if (req.body.status) extraFields.status = req.body.status;
      // if (req.body.google_sheet) extraFields.google_sheet = req.body.google_sheet;
      // if (req.body.valid_email_count) extraFields.valid_email_count = req.body.valid_email_count;
     

      // Final request body
      const finalBody = {
        apollo_query: {
            ...finalBodyFilter,
            per_page: 100,
            page: 1,
        },
       ...extraFields
      };

      const headers = {
          "Content-Type": "application/json",
      };
      
      const response = await axios.post(searchAPI, finalBody, {
        headers,
      });

      if (response.status !== 200) {
        throw new Error("Failed to create export");
      }

      const deductionResult = await deductCredits(userID, credits);
      if (!deductionResult.success) {
        res.status(400).json({ message: "Failed to deduct credits" });
        return;
      }

      const updatedUser = await getUser(userID);
      if (!updatedUser) {
        res
          .status(400)
          .json({ message: "Failed to retrieve updated user data" });
        return;
      }

      let additionalInformation = "";
      if (userSubscriptionCredits >= credits) {
        additionalInformation = "Used subscription credits.";
      } else if (userSubscriptionCredits > 0) {
        additionalInformation = "Subscription Exhausted. Using bought credits.";
      } else {
        additionalInformation = "Used bought credits.";
      }

      res.status(200).json({
        message: `Export created successfully`,
        // balance: {
        //   subscriptionCredits: updatedUser.subscriptionCredits ?? 0,
        //   purchasedCredits: updatedUser.credits,
        //   totalCredits:
        //     (updatedUser.subscriptionCredits ?? 0) + updatedUser.credits,
        // },
        // additional_information: additionalInformation,
        // log: newLog,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
);

export default app;
