from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

import stripe
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, ConfigDict

from core.config import Settings, get_settings


router = APIRouter(prefix="/payment", tags=["payment"])


# Match the legacy Node implementation (`api/routes/payment/index.js`)
STORE_ITEMS: dict[str, dict[str, Any]] = {
	"s": {"price": 100, "name": "ちょっと応援する"},
	"m": {"price": 1000, "name": "もっと応援する"},
	"l": {"price": 10000, "name": "めっちゃ応援する"},
}

SUB_STORE_ITEMS: dict[str, dict[str, Any]] = {
	"s": {
		"price": 100,
		"name": "ちょっと応援する",
		"id": "prod_SLGqXcNZN4X4ic",
		"price_id": "price_1RQaIuHdbYFF47cBvjqqKLCh",
	},
	"m": {
		"price": 1000,
		"name": "もっと応援する",
		"id": "prod_SLGre4siQXau8D",
		"price_id": "price_1RQaJJHdbYFF47cBwUK3kxzQ",
	},
	"l": {
		"price": 10000,
		"name": "めっちゃ応援する",
		"id": "prod_SLGraGqjJVY4Fo",
		"price_id": "price_1RQaJgHdbYFF47cBEYKqNSke",
	},
}


def _ensure_stripe(settings: Settings) -> None:
	if not settings.stripe_secret_key:
		raise HTTPException(status_code=500, detail="Stripe is not configured (missing STRIPE_SECRET_KEY)")
	stripe.api_key = settings.stripe_secret_key


def _success_url(frontend_url: str) -> str:
	return f"{frontend_url.rstrip('/')}/payment-success"


def _cancel_url(frontend_url: str) -> str:
	return f"{frontend_url.rstrip('/')}/payment-cancel"


class CheckoutItem(BaseModel):
	model_config = ConfigDict(extra="ignore")
	quantity: int = Field(default=0, ge=0)
	name: Optional[str] = None


class CreateSessionBody(BaseModel):
	model_config = ConfigDict(extra="ignore")
	items: Dict[str, CheckoutItem]


@router.get("/config", summary="Stripe config")
async def config(settings: Settings = Depends(get_settings)) -> dict[str, Any]:
	# Server-side only; safe to return publishable key.
	return {"stripePublishableKey": settings.stripe_publishable_key}


@router.post("/create-payment-session", summary="Create Stripe checkout session (one-time)")
async def create_payment_session(
	body: CreateSessionBody,
	settings: Settings = Depends(get_settings),
) -> dict[str, Any]:
	_ensure_stripe(settings)

	line_items: List[dict[str, Any]] = []
	for key, item in body.items.items():
		if item.quantity <= 0:
			continue
		store_item = STORE_ITEMS.get(key)
		if not store_item:
			raise HTTPException(status_code=400, detail=f"Unknown item key: {key}")
		line_items.append(
			{
				"price_data": {
					"currency": "jpy",
					"product_data": {"name": store_item["name"]},
					"unit_amount": int(store_item["price"]),
				},
				"quantity": int(item.quantity),
			}
		)

	if not line_items:
		raise HTTPException(status_code=400, detail="No items selected")

	try:
		session = stripe.checkout.Session.create(
			payment_method_types=["card"],
			mode="payment",
			line_items=line_items,
			success_url=_success_url(settings.frontend_url),
			cancel_url=_cancel_url(settings.frontend_url),
			locale="ja",
		)
		return {"url": session.url}
	except Exception as e:
		raise HTTPException(status_code=500, detail=str(e))


@router.post("/create-subscription-session", summary="Create Stripe checkout session (subscription)")
async def create_subscription_session(
	body: CreateSessionBody,
	settings: Settings = Depends(get_settings),
) -> dict[str, Any]:
	_ensure_stripe(settings)

	line_items: List[dict[str, Any]] = []
	for key, item in body.items.items():
		if item.quantity <= 0:
			continue
		store_item = SUB_STORE_ITEMS.get(key)
		if not store_item:
			raise HTTPException(status_code=400, detail=f"Unknown item key: {key}")
		line_items.append({"quantity": int(item.quantity), "price": store_item["price_id"]})

	if not line_items:
		raise HTTPException(status_code=400, detail="No items selected")

	try:
		session = stripe.checkout.Session.create(
			payment_method_types=["card"],
			mode="subscription",
			line_items=line_items,
			success_url=_success_url(settings.frontend_url),
			cancel_url=_cancel_url(settings.frontend_url),
			locale="ja",
		)
		return {"url": session.url}
	except Exception as e:
		raise HTTPException(status_code=500, detail=str(e))


class CustomerBody(BaseModel):
	model_config = ConfigDict(extra="ignore")
	email: str
	name: Optional[str] = None


class CreatePaymentIntentBody(BaseModel):
	model_config = ConfigDict(extra="ignore")
	items: Dict[str, CheckoutItem]
	customer: Optional[CustomerBody] = None


@router.post("/create-payment-intent", summary="Create Stripe PaymentIntent (mobile)")
async def create_payment_intent(
	body: CreatePaymentIntentBody,
	settings: Settings = Depends(get_settings),
) -> dict[str, Any]:
	_ensure_stripe(settings)

	total_amount = 0
	items_out: List[dict[str, Any]] = []
	for key, item in body.items.items():
		if item.quantity <= 0:
			continue
		store_item = STORE_ITEMS.get(key)
		if not store_item:
			raise HTTPException(status_code=400, detail=f"Unknown item key: {key}")
		amount = int(store_item["price"]) * int(item.quantity)
		total_amount += amount
		items_out.append({"name": store_item["name"], "quantity": int(item.quantity), "amount": amount})

	if total_amount == 0:
		raise HTTPException(status_code=400, detail="No items selected")

	customer_id: Optional[str] = None
	customer = body.customer
	if customer and customer.email:
		try:
			existing = stripe.Customer.list(email=customer.email, limit=1)
			if existing.data:
				customer_id = existing.data[0].id
			else:
				created = stripe.Customer.create(
					email=customer.email,
					name=customer.name or None,
					metadata={"source": "mobile_app"},
				)
				customer_id = created.id
		except Exception:
			# Match Node behavior: continue without a customer if lookup/create fails
			customer_id = None

	pi_kwargs: dict[str, Any] = {
		"amount": total_amount,
		"currency": "jpy",
		"automatic_payment_methods": {"enabled": True},
		"metadata": {
			"items": json.dumps(items_out, ensure_ascii=False),
			"source": "mobile_app",
			"customer_email": customer.email if customer else "",
			"customer_name": customer.name if customer else "",
		},
	}
	if customer_id:
		pi_kwargs["customer"] = customer_id

	try:
		pi = stripe.PaymentIntent.create(**pi_kwargs)
		return {
			"client_secret": pi.client_secret,
			"amount": total_amount,
			"items": items_out,
			"customer": customer.model_dump() if customer else None,
		}
	except Exception as e:
		raise HTTPException(status_code=500, detail=str(e))


class CreateCustomerPortalBody(BaseModel):
	model_config = ConfigDict(extra="ignore")
	email: str


@router.post("/create-customer-portal", summary="Create Stripe customer portal session")
async def create_customer_portal(
	body: CreateCustomerPortalBody,
	settings: Settings = Depends(get_settings),
) -> dict[str, Any]:
	_ensure_stripe(settings)

	email = body.email.strip()
	if not email:
		raise HTTPException(status_code=400, detail="Email is required")

	try:
		customers = stripe.Customer.list(email=email, limit=1)
		if not customers.data:
			raise HTTPException(status_code=404, detail="Customer not found")
		customer = customers.data[0]
		portal = stripe.billing_portal.Session.create(
			customer=customer.id,
			return_url=settings.frontend_url.rstrip("/"),
		)
		return {"url": portal.url}
	except HTTPException:
		raise
	except Exception as e:
		raise HTTPException(status_code=500, detail=str(e))


