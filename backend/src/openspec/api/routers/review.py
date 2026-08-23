from fastapi import APIRouter

router = APIRouter(prefix="/api/v1/review", tags=["review"])

@router.get("/tasks/counts")
def get_task_counts():
    return {
        "counts": {},
        "total_open": 0
    }