export type DonationItem = {
  quantity: number;
  [k: string]: unknown;
};

export type DonationItems = Record<string, DonationItem>;

export async function createCheckoutSession(params: {
  subscription: boolean;
  items: DonationItems;
}): Promise<{ url: string }> {
  const res = await fetch("/api/payment/create-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Request failed: ${res.status} ${res.statusText}${text ? ` — ${text}` : ""}`);
  }
  const data = (await res.json()) as { url?: unknown };
  if (typeof data.url !== "string" || !data.url) {
    throw new Error("Unexpected response: missing checkout URL");
  }
  return { url: data.url };
}

export async function fetchStripeConfig(): Promise<{ stripePublishableKey: string | null }> {
  const res = await fetch("/api/payment/config", { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Request failed: ${res.status} ${res.statusText}${text ? ` — ${text}` : ""}`);
  }
  const data = (await res.json()) as { stripePublishableKey?: unknown };
  return { stripePublishableKey: typeof data.stripePublishableKey === "string" ? data.stripePublishableKey : null };
}

export async function createPaymentIntent(params: {
  items: DonationItems;
  customer?: { email: string; name?: string } | null;
}): Promise<{
  client_secret: string;
  amount: number;
  items: Array<{ name: string; quantity: number; amount: number }>;
  customer: { email: string; name?: string } | null;
}> {
  const res = await fetch("/api/payment/create-payment-intent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Request failed: ${res.status} ${res.statusText}${text ? ` — ${text}` : ""}`);
  }
  return (await res.json()) as any;
}

export async function createCustomerPortal(email: string): Promise<{ url: string }> {
  const res = await fetch("/api/payment/create-customer-portal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Request failed: ${res.status} ${res.statusText}${text ? ` — ${text}` : ""}`);
  }
  const data = (await res.json()) as { url?: unknown };
  if (typeof data.url !== "string" || !data.url) {
    throw new Error("Unexpected response: missing portal URL");
  }
  return { url: data.url };
}


