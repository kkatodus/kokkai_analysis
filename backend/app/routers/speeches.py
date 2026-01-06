from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException

from core.storage import get_storage, Storage

router = APIRouter(prefix="/speeches", tags=["speeches"])


@router.get("/available", summary="Available speeches")
async def available_speeches(
	person_id: str,
    storage: Storage = Depends(get_storage),
) -> Any:
	try:
		speech_files = storage.read_directory(f"kokkai-doc/repr_speeches_id_organized/{person_id}")
	except FileNotFoundError:
		raise HTTPException(status_code=404, detail="Person not found")
	return {
		"available_speeches": speech_files,
	}


@router.get("/get", summary="Get speech for a topic with page number")
async def get_speech(
	person_id: str, 
	topic: str, 
	page_number: int,
	storage: Storage = Depends(get_storage)):
	
	page = storage.read_jsonl_paginated(f"kokkai-doc/repr_speeches_id_organized/{person_id}/{topic}.jsonl", page_number)
	return {
		"page_number": page.page_number,
		"number_of_lines": len(page.lines),
		"total_pages": page.total_pages,
		"total_lines": page.total_lines,
		"page": page.lines,
	}
	
@router.get("/get_first_page_of_all_topics", summary="Get first page of all topics for a person")
async def get_first_page_of_all_topics(
	person_id: str,
	storage: Storage = Depends(get_storage)):
	
	topics = storage.read_directory(f"kokkai-doc/repr_speeches_id_organized/{person_id}")
	first_pages_of_all_topics = []
	for topic in topics:
		page = storage.read_jsonl_paginated(f"kokkai-doc/repr_speeches_id_organized/{person_id}/{topic}", 0)
		first_pages_of_all_topics.append({
			"topic": topic,
			"page": page.lines,
			"number_of_pages": page.total_pages,
		})
	return {
		"first_pages_of_all_topics": first_pages_of_all_topics,
	}