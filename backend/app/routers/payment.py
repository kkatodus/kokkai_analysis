from typing import Any, Dict, List

import stripe
from fastapi import APIRouter, Depends, HTTPException, status

from core.config import Settings, get_settings

router = APIRouter(prefix="/payment", tags=["payment"])

BASIC_PRODUCTS: Dict[str, Dict[str, Any]] = {
    "s": {"price": 100, "name": "ちょっと応援する"},
    "m": {"price": 1000, "name": "まあまあ応援する"},
    "l": {"price": 10000, "name": "めっちゃ応援する"},
}

SUBSCRIPTION_PRODUCTS: Dict[str, Dict[str, Any]] = {
    "s": {"price": 100, "name": "ちょっと応援する", "price_id": "price_1RQaIuHdbYFF47cBvjqqKLCh"},
    "m": {"price": 1000, "name": "まあまあ応援する", "price_id": "price_1RQaJJHdbYFF47cBwUK3kxzQ"},
    "l": {"price": 10000, "name": "めっちゃ応援する", "price_id": "price_1RQaJgHdbYFF47cBEYKqNSke"},
}


def _require_stripe(settings: Settings) -> stripe.stripe_object.StripeObject | stripe.api_resources.abstract.APIResource:
    if not settings.stripe_secret_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Stripe secret key is not configured",
        )
    stripe.api_key = settings.stripe_secret_key
    return stripe


@router.get("/config", summary="Stripe publishable key")
async def payment_config(settings: Settings = Depends(get_settings)) -> Dict[str, str]:
    if not settings.stripe_publishable_key:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Stripe is not configured")
    return {"stripePublishableKey": settings.stripe_publishable_key}


@router.post("/create-payment-session", summary="Create one-time payment session")
async def create_payment_session(
    payload: Dict[str, Dict[str, Any]], settings: Settings = Depends(get_settings)
) -> Dict[str, str]:
    stripe_client = _require_stripe(settings)
    checkout_data = payload.get("items", {})

    line_items: List[Dict[str, Any]] = []
    for key, item in checkout_data.items():
        quantity = item.get("quantity", 0)
        if quantity:
            product = BASIC_PRODUCTS.get(key)
            if not product:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unknown product: {key}")
            line_items.append(
                {
                    "price_data": {
                        "currency": "jpy",
                        "product_data": {"name": item.get("name", product["name"] )},
                        "unit_amount": product["price"],
                    },
                    "quantity": quantity,
                }
            )

    if not line_items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No items selected")

    session = stripe_client.checkout.Session.create(
        payment_method_types=["card"],
        mode="payment",
        line_items=line_items,
        success_url=f"{settings.frontend_url}/payment-success",
        cancel_url=f"{settings.frontend_url}/payment-cancel",
        locale="ja",
    )
    return {"url": session.url}


@router.post("/create-subscription-session", summary="Create subscription payment session")
async def create_subscription_session(
    payload: Dict[str, Dict[str, Any]], settings: Settings = Depends(get_settings)
) -> Dict[str, str]:
    stripe_client = _require_stripe(settings)
    checkout_data = payload.get("items", {})

    line_items: List[Dict[str, Any]] = []
    for key, item in checkout_data.items():
        quantity = item.get("quantity", 0)
        if quantity:
            product = SUBSCRIPTION_PRODUCTS.get(key)
            if not product:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unknown product: {key}")
            line_items.append({"quantity": quantity, "price": product["price_id"]})

    if not line_items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No items selected")

    session = stripe_client.checkout.Session.create(
        payment_method_types=["card"],
        mode="subscription",
        line_items=line_items,
        success_url=f"{settings.frontend_url}/payment-success",
        cancel_url=f"{settings.frontend_url}/payment-cancel",
        locale="ja",
    )
    return {"url": session.url}


@router.post("/create-payment-intent", summary="Create payment intent for mobile wallets")
async def create_payment_intent(
    payload: Dict[str, Any], settings: Settings = Depends(get_settings)
) -> Dict[str, Any]:
    stripe_client = _require_stripe(settings)
    checkout_data = payload.get("items", {})
    customer_data = payload.get("customer", {})

    amount = 0
    for key, item in checkout_data.items():
        quantity = item.get("quantity", 0)
        if quantity:
            product = BASIC_PRODUCTS.get(key)
            if not product:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unknown product: {key}")
            amount += product["price"] * quantity

    if amount <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No items selected")

    payment_intent = stripe_client.PaymentIntent.create(
        amount=amount,
        currency="jpy",
        receipt_email=customer_data.get("email"),
        metadata={"customer_name": customer_data.get("name", "")},
        automatic_payment_methods={"enabled": True},
    )
    return {"clientSecret": payment_intent.client_secret}
