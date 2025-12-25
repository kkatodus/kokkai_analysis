from pathlib import Path
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, status

from ..core.config import Settings, get_settings
from ..services.data_loader import DataLoader
from .dependencies import get_data_loader

router = APIRouter(prefix="/manifesto", tags=["manifesto"])


@router.get("/parties", summary="List parties with available manifesto data")
async def available_parties(
    settings: Settings = Depends(get_settings), loader: DataLoader = Depends(get_data_loader)
) -> Dict[str, Any]:
    base_dir = settings.manifesto_dir
    if not base_dir.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Manifesto data directory not found")

    parties: List[Dict[str, Any]] = []
    for item in sorted(base_dir.iterdir()):
        if item.is_dir():
            parties.append(
                {
                    "name": item.name,
                    "hasPolicies": (item / "policies.json").exists(),
                    "hasCoherence": (item / "investigated_coherence.json").exists(),
                }
            )
    return {"parties": parties, "count": len(parties)}


@router.get("/party/{partyName}", summary="Manifesto data for a party")
async def party_manifesto(
    partyName: str,
    settings: Settings = Depends(get_settings),
    loader: DataLoader = Depends(get_data_loader),
) -> Dict[str, Any]:
    if not partyName:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Party name is required")

    decoded_party = partyName
    party_dir = settings.manifesto_dir / decoded_party
    if not party_dir.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Party '{decoded_party}' not found")

    policies = None
    coherence = None
    policies_path = party_dir / "policies.json"
    coherence_path = party_dir / "investigated_coherence.json"

    if policies_path.exists():
        policies = loader.load_json(policies_path)
    if coherence_path.exists():
        coherence = loader.load_json(coherence_path)

    return {"party": decoded_party, "policies": policies, "coherence": coherence}
