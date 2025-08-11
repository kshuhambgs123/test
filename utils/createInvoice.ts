import axios from "axios";
import { InvoiceData } from "../types/interfaces";
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
