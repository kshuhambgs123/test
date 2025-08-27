import axios from "axios";
import { InvoiceData, InvoiceSubscriptionData } from "../types/interfaces";
import { writeFileSync } from "fs";
export async function createInvoice(
  from: string,
  to: string,
  quantity: number,
  unitCost: number,
  currency: string,
  amountPaid: number
): Promise<Buffer | null> {
  try {
    const invoiceNumber = "INV-" + Math.floor(Math.random() * 100000000000);
    const data: InvoiceData = {
      from: from,
      to: to,
      logo: process.env.LOGO_URL as string,
      number: invoiceNumber,
      date: new Date().toISOString().split("T")[0],
      "items[0][name]": "Leads",
      "items[0][quantity]": quantity.toString(),
      "items[0][unit_cost]": unitCost.toString(),
      notes: "Thank you for being an awesome customer! You MOG 🫵😹!",
      currency: currency,
      amount_paid: amountPaid.toString(),
      "custom_fields[0][name]": "Subscription Type",
      "custom_fields[0][value]": "Pay As You Go",
    };

    const headers = {
      Authorization: `Bearer ${process.env.INVOICE_API_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    };

    console.log(data, headers);

    const response = await axios.post(
      process.env.INVOICE_API_URL as string,
      data,
      {
        headers,
        responseType: "arraybuffer",
      }
    );

    if (response.status !== 200) {
      throw new Error("Failed to create invoice");
    }
    writeFileSync("invoice.pdf", response.data.toString("base64"), "base64");

    return response.data;
  } catch (error: any) {
    throw new Error(error.message);
  }
}
export async function createSubscriptionInvoice(
  from: string,
  to: string,
  currency: string,
  amountPaid: number,
  tierName: string,
  status: string,
  customer_email: string,
  customer_name: string,
  issuer_type: string,
  subscription_type: string,
  customer_address: string,
  customer_phone: string,
): Promise<Buffer> {
  try {
    const invoiceNumber = "INV-" + Math.floor(Math.random() * 100000000000);
    const data: Record<string, string> = {
      from,
      to,
      logo: process.env.LOGO_URL as string,
      number: invoiceNumber,
      date: new Date().toISOString().split("T")[0],
      "items[0][name]": tierName,
      // "items[0][quantity]": "1",
      "items[0][unit_cost]": amountPaid.toString(),
      notes: "Thank you for being an awesome customer! You MOG 🫵😹!",
      currency,
      amount_paid: amountPaid.toString(),
      // "custom_fields[0][name]": "Tier Name",
      // "custom_fields[0][value]": tierName,
      "custom_fields[1][name]": "Status",
      "custom_fields[1][value]": status,
      "custom_fields[2][name]": "Issuer Type",
      "custom_fields[2][value]": issuer_type,
      "custom_fields[3][name]": "Subscription Type",
      "custom_fields[3][value]": subscription_type,
      "custom_fields[4][name]": "Customer Email",
      "custom_fields[4][value]": customer_email,
      "custom_fields[5][name]": "Customer Address",
      "custom_fields[5][value]": customer_address || '',
      "custom_fields[6][name]": "Customer Phone",
      "custom_fields[6][value]": customer_phone || '',
    };

    const headers = {
      Authorization: `Bearer ${process.env.INVOICE_API_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    };

    const body = new URLSearchParams(data).toString();

    const response = await axios.post(
      process.env.INVOICE_API_URL as string,
      body,
      {
        headers,
        responseType: "arraybuffer",
      }
    );

    if (response.status !== 200) {
      throw new Error("Failed to create invoice");
    }

    writeFileSync("invoice.pdf", response.data);

    return Buffer.from(response.data);
  } catch (error: any) {
    throw new Error(error.message);
  }
}