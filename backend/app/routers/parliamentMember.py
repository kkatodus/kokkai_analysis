from typing import Any

import os
from fastapi import APIRouter
from boto3 import client as boto3_client

router = APIRouter(prefix="/parliamentMember", tags=["parliamentMember"])
s3 = boto3_client('s3')

@router.get("/", summary="Parliament member data")
async def parliament_member_data() -> Any:
	bucket_name = os.environ.get("DATA_LAKE_BUCKET_NAME")
	prefix = "/kokkai-doc/parliamentMembers/"
	objects = []
	for obj in s3.list_objects_v2(Bucket=bucket_name, Prefix=prefix)['Contents']:
		objects.append(obj['Key'])
	
	return {"message": "Parliament member data", "objects": objects}