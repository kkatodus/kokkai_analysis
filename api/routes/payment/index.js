import express from "express";
import dotenv from "dotenv";
import Stripe from "stripe";
dotenv.config();

const router = express.Router();
router.use(express.static("public"));
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://kokkaidoc.com';

const storeItems = new Map([
  ["s", { price: 100, name: "ちょっと応援する" }],
  ["m", { price: 1000, name: "まあまあ応援する" }],
  ["l", { price: 10000, name: "めっちゃ応援する" }],
]);

const subStoreItems = new Map([
  ["s", { price: 100, name: "ちょっと応援する", id: "prod_SLGqXcNZN4X4ic", price_id:"price_1RQaIuHdbYFF47cBvjqqKLCh"}],
  ["m", { price: 1000, name: "まあまあ応援する", id: "prod_SLGre4siQXau8D", price_id:"price_1RQaJJHdbYFF47cBwUK3kxzQ"}],
  ["l", { price: 10000, name: "めっちゃ応援する", id: "prod_SLGraGqjJVY4Fo", price_id:"price_1RQaJgHdbYFF47cBEYKqNSke"}],
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
      locale: "ja",
    }).catch((error) => {
      console.log('error', error);
    });

    res.json({ url: session.url });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/create-subscription-session", async (req, res) => {
    try {
      const checkoutData = req.body.items;
      let line_items = Object.keys(checkoutData).map((key) => {
        if (checkoutData[key].quantity !== 0) {
          return {
            quantity: checkoutData[key].quantity,
            price: subStoreItems.get(key).price_id,
          };
        }
      });
      line_items = line_items.filter((item) => item !== undefined);
  
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "subscription",
        line_items: line_items,
        success_url: `https://kokkaidoc.com/payment-success`,
        cancel_url: `https://kokkaidoc.com/payment-cancel`,
        locale: "ja",
      }).catch((error) => {
        console.log('error', error);
      });
      res.json({ url: session.url });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

// New endpoint for mobile payment intents (Apple Pay, Google Pay)
router.post("/create-payment-intent", async (req, res) => {
  try {
    const checkoutData = req.body.items;
    const customerData = req.body.customer; // { email, name }

    // Calculate total amount
    let totalAmount = 0;
    const items = [];
    
    Object.keys(checkoutData).forEach((key) => {
      if (checkoutData[key].quantity > 0) {
        const itemPrice = storeItems.get(key).price;
        const quantity = checkoutData[key].quantity;
        totalAmount += itemPrice * quantity;
        items.push({
          name: checkoutData[key].name,
          quantity: quantity,
          amount: itemPrice * quantity
        });
      }
    });

    if (totalAmount === 0) {
      return res.status(400).json({ error: "No items selected" });
    }

    // Create or find customer if email/name provided
    let customerId = null;
    if (customerData && customerData.email) {
      try {
        // Check if customer already exists
        const existingCustomers = await stripe.customers.list({
          email: customerData.email,
          limit: 1
        });

        if (existingCustomers.data.length > 0) {
          // Customer exists, use existing ID
          customerId = existingCustomers.data[0].id;
        } else {
          // Create new customer
          const customer = await stripe.customers.create({
            email: customerData.email,
            name: customerData.name || undefined,
            metadata: {
              source: "mobile_app",
              created_date: new Date().toISOString()
            }
          });
          customerId = customer.id;
        }
      } catch (customerError) {
        console.error('Customer creation error:', customerError);
        // Continue without customer if there's an error
      }
    }

    // Create payment intent for mobile
    const paymentIntentData = {
      amount: totalAmount,
      currency: "jpy",
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        items: JSON.stringify(items),
        source: "mobile_app",
        customer_email: customerData?.email || "",
        customer_name: customerData?.name || ""
      }
    };

    // Add customer if we have one
    if (customerId) {
      paymentIntentData.customer = customerId;
    }

    const paymentIntent = await stripe.paymentIntents.create(paymentIntentData);

    res.json({ 
      client_secret: paymentIntent.client_secret,
      amount: totalAmount,
      items: items,
      customer: customerData || null
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Customer portal for subscription management
router.post("/create-customer-portal", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    // Find customer by email
    const customers = await stripe.customers.list({
      email: email,
      limit: 1
    });

    if (customers.data.length === 0) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const customer = customers.data[0];

    // Create customer portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customer.id,
      return_url: `${FRONTEND_URL}`,
    });

    res.json({ url: portalSession.url });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
