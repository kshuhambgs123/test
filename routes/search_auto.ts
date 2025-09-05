// search_auto.ts

import { LogsV2 } from "@prisma/client";
import dotenv from "dotenv";
import express, { Request, Response } from "express";
import formdata from "form-data";
import { updateCredits } from "../db/admin";
import { createLogOnly, updateLog } from "../db/log";
import { deductCredits, deductSearchCredits } from "../db/subscription";
import { getUser } from "../db/user";
import { getFundingValues } from "../db/funding";
import { LeadStatusResponse } from "../types/interfaces";
import verifySessionToken from "../middleware/supabaseAuth";
import { request } from "http";
import { safeParse, z } from "zod";
import { getIndustryIds } from "../db/industry";
import axios from "axios";
import { Country, State, City } from 'country-state-city';
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
    organization_latest_funding_stage_cd: organization_industry_display_code.length > 0 ? organization_industry_display_code : [],  
  };
}

app.post(
  "/search",
  verifySessionToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userID = (req as any).user.id;
      const user = await getUser(userID);

      if (!user) {
        res.status(404).json({ message: "User not found" });
        return;
      }

      const parsedBodySafe = searchSchema.safeParse(req.body)
      if (!parsedBodySafe.success) {
          // console.log("Validation errors: ", parsedBodySafe.error.format());
          res.status(400).json({
            message: "Invalid request body",
            errors: parsedBodySafe.error.format(),
          });
          return;
      }
      // console.log("Parsed body: ", req.body.organization_industry_display_name);
      const body = await handleRequest(req.body);

      // ---------------- CREDIT ENFORCEMENT ----------------
      const searchCost = 1;
      const userSearchCredits = user.searchCredits ?? 0;

      if (userSearchCredits < searchCost) {
        res.status(400).json({
          message: "Free search credits exhausted.",
          // availableCredits: {
          //   searchCredits: userSearchCredits,
          //   // purchasedCredits: user.credits,
          //   // totalCredits,
          // },
        });
        return;
      }

       // Deduct credits
      const deductionResult = await deductSearchCredits(userID, searchCost);
      if (!deductionResult.success) {
          res.status(400).json({ message: "Failed to deduct credits" });
          return;
      }

      // ---------------- CALL SEARCH API ----------------

      const searchAPI = process.env.SAMPLESEARCHAUTOMATIONAPI as string;

      const finalBody = { ...body.cleanedBody, organization_industry_tag_ids: body.organization_industry_tag_ids , organization_not_industry_tag_ids: body.organization_not_industry_tag_ids , organization_latest_funding_stage_cd: body.organization_latest_funding_stage_cd};
      console.log("Final body to send: ", finalBody, finalBody.organization_latest_funding_stage_cd);
      const headers = {
          "Content-Type": "application/json",
      };
      
      const response = await axios.post(searchAPI, finalBody, {
        headers,
        timeout: 20000, // 20 seconds
      });

      if (!response || response.status !== 200) {
        throw new Error("Failed to fetch");
      }
      
      res.status(200).json({
          message: `People fetched successfully`,
          data: response.data,
      });
      return;

    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
);

app.get(
  "/location",
  verifySessionToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userID = (req as any).user.id;
      const user = await getUser(userID);

      if (!user) {
        res.status(404).json({ message: "User not found" });
        return;
      }

      const search = req.query.search as string | undefined;

      if (!search) {
        // No search query — mask the data
        res.json({
          countries: [],
          states: [],
          cities: []
        });
        return;
      }

      // Build regex (escape special characters)
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escapedSearch, 'i'); // 'i' for case-insensitive

      // Filter using regex
      const countries = Country.getAllCountries().filter((country) =>
        searchRegex.test(country.name)
      );

      const states = State.getAllStates().filter((state) =>
        searchRegex.test(state.name)
      );

      const cities = City.getAllCities().filter((city) =>
        searchRegex.test(city.name)
      );

      res.json({
        countries,
        states,
        cities
      });
      return;

    } catch (error) {
      console.error("Error fetching location data:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }
);

export default app;
