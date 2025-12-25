from fastapi import APIRouter

router = APIRouter()

api_guide = {
    "sangiin meeting names": "sangiin/meeting_names",
    "sangiin commitee names": "sangiin/commitee",
    "sangiin representatives": "sangiin/repr",
    "sangiin vote results": "sangiin/sangiin_meeting_votes/:meeting_name",
    "sangiin party opinions": "sangiin/sangiin_party_opinions/:meeting_name/:topic_name",
    "shugiin commitees": "shugiin/commitee",
    "shugiin representatives": "shugiin/repr",
    "speech summary": "speeches",
    "lower house speech summary": "speeches/lower",
    "upper house speech summary": "speeches/upper",
    "position stats": "stats/position",
    "available parties": "manifesto/parties",
    "party manifesto data": "manifesto/party/:partyName",
}


@router.get("", summary="API guide", tags=["guide"])
async def guide() -> dict[str, str]:
    return api_guide
