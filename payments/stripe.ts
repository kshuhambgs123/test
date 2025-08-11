import dotenv from "dotenv";
import stripe from "stripe";
dotenv.config()

export const stripeClient = new stripe(process.env.STRIPE_PUBLIC_SECRET_KEY as string, {
    typescript: true,
});