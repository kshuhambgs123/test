import { BillingDetails } from "@prisma/client";

import { prisma } from "./index";

export async function createInvoiceEntry(
  userID: string,
  billingID: string,
  url: string,
  creditsRequested: number
) {
  try {
    const invoice = await prisma.billingDetails.create({
      data: {
        BillingID: billingID,
        userID: userID,
        Url: url,
        CreditsRequested: creditsRequested,
        date: new Date(),
        subscription_type: 'Pay As You Go',
      },
    });

    if (!invoice) {
      return null;
    }

    return invoice;
  } catch (error: any) {
    throw new Error(error.message);
  }
}

export async function createSubscriptionInvoiceEntry(
  userID: string,
  billingID: string,
  url: string,
  creditsRequested: number,
  tierName : string,
  status : string,
  customer_email : string,
  customer_name : string,
  issuer_type : string,
  subscription_type :  string
) {
  try {
    const invoice = await prisma.billingDetails.create({
      data: {
        BillingID: billingID,
        userID: userID,
        Url: url,
        CreditsRequested: creditsRequested,
        tierName: tierName,
        status: status,  
        customer_email: customer_email, 
        customer_name: customer_email, 
        issuer_type: issuer_type,
        subscription_type: subscription_type,
        date: new Date(),
      },
    });

    if (!invoice) {
      return null;
    }

    return invoice;
  } catch (error: any) {
    throw new Error(error.message);
  }
}

export async function getInvoicesByUserID(
  userID: string
): Promise<BillingDetails[]> {
  try {
    const invoice = await prisma.billingDetails.findMany({
      where: {
        userID: userID,
      },
    });

    return invoice;
  } catch (error: any) {
    throw new Error(error.message);
  }
}

export async function getAllInvoices(): Promise<BillingDetails[]> {
  try {
    // const invoice = await prisma.billingDetails.findMany();
    const invoice = await prisma.billingDetails.findMany({
      include: {
        user: {
          select: {
            UserID: true,
            email: true,
            name: true,
          },
        },
      },
    });


    if (!invoice) {
      return [];
    }
    return invoice;
  } catch (error: any) {
    throw new Error(error.message);
  }
}

export async function getInvoiceByBillingID(
  billingID: string
): Promise<BillingDetails | null> {
  try {
    const invoice = await prisma.billingDetails.findUnique({
      where: {
        BillingID: billingID,
      },
    });

    return invoice || null;
  } catch (error: any) {
    throw new Error(error.message);
  }
}
