from typing import Any

import os
from fastapi import APIRouter, Depends
from core.storage import get_storage, Storage
from core.config import get_settings
from core.config import Settings
import boto3

router = APIRouter(prefix="/parliamentMember", tags=["parliamentMember"])


@router.get("/", summary="Parliament member data")
async def parliament_member_data(storage: Storage = Depends(get_storage)) -> Any:
	object_keys = storage.read_directory("kokkai-doc/parliamentMembers/")

	return {"message": "Parliament member data", "object_keys": object_keys}