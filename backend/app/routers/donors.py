from fastapi import APIRouter

router = APIRouter(prefix="/donors", tags=["donors"])

DONORS = [
    "Kohei Oshida",
    "あさがお",
    "t0m0t05h1n90",
    "AMI-T Co., Ltd. アミット",
    "あきら",
    "MAYUTA",
    "傑木 優",
    "大和魂の会、大和　心",
    "未来塾コミュニティ運営講師、icchy",
    "西 拓磨",
    "医療法人トータルライフ医療会理事長、馬渕茂樹",
    "supermakochan/ありキング",
    "すぎまり",
    "三枝",
    "清島ハリス",
    "フットサルが好きな映像家、Kazuhiro Joy Kimura®︎",
    "前：福岡県福岡市立小学校教師（退職）、鈴木　　太",
    "匠P",
    "末広直也",
    "桜井美空",
    "Sumitarou(SumiYama)",
    "日本人である事の幸せ、KAZUTO",
]


@router.get("/", summary="List of donors")
async def donors() -> dict[str, list[str]]:
    return {"donors": DONORS}
