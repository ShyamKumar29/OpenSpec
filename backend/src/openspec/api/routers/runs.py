from fastapi import APIRouter
from typing import Optional

router = APIRouter(prefix="/api/v1/runs", tags=["runs"])

@router.get("")
@router.get("/")
def get_runs(status: Optional[str] = None, limit: int = 25):
    # We are returning an empty array to tell the dashboard that 
    # no extraction jobs are currently running.
    return {
        "items": [],
        "total_count": 0,
        "page": 1
    }