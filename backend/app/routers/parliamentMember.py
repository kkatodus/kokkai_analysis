from typing import Any

import os
from fastapi import APIRouter
import boto3

router = APIRouter(prefix="/parliamentMember", tags=["parliamentMember"])


@router.get("/", summary="Parliament member data")
async def parliament_member_data() -> Any:
	s3 = boto3.resource('s3')
	bucket = s3.Bucket(os.environ.get("DATA_LAKE_BUCKET_NAME"))

	objects = bucket.objects.filter(Prefix="/kokkai-doc/parliamentMembers/")
	object_keys = [obj.key for obj in objects]

	print("object_keys", object_keys)

	return {"message": "Parliament member data", "object_keys": object_keys}