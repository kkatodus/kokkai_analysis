import express from "express";
import dotenv from "dotenv";
import Stripe from "stripe";
dotenv.config();

const router = express.Router();
router.use(express.static("public"));
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const storeItems = new Map([
  ["s", { price: 100, name: "ちょっと応援する" }],
  ["m", { price: 1000, name: "まあまあ応援する" }],
  ["l", { price: 10000, name: "めっちゃ応援する" }],
]);

router.get("/config", async (req, res) => {
  res.send({
    stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
  });
});

router.post("/create-payment-session", async (req, res) => {
  try {
    const checkoutData = req.body.items;

    const line_items = Object.keys(checkoutData).map((key) => {
      if (checkoutData[key].quantity !== 0) {
        return {
          price_data: {
            currency: "jpy",
            product_data: {
              name: checkoutData[key].name,
            },
            unit_amount: storeItems.get(key).price,
          },
          quantity: checkoutData[key].quantity,
        };
      }
    });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: line_items.filter((item) => item !== undefined),
      success_url: `https://kokkaidoc.com/payment-success`,
      cancel_url: `https://kokkaidoc.com/payment-cancel`,
    });
    res.json({ url: session.url });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
