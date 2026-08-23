from fastapi import APIRouter
from fastapi.responses import Response
import os
from fastapi import HTTPException
from fastapi.responses import FileResponse
from datetime import datetime
import io
from PIL import Image

router = APIRouter(prefix="/api/v1/documents", tags=["documents"])

@router.get("/{document_version_id}")
def get_document(document_version_id: str):
    now = datetime.utcnow().isoformat() + "Z"
    return {
        "document_version_id": document_version_id,
        "document_id": "doc_base_123",
        "publisher": "Demo Manufacturer",
        "title": "Technical Specification Sheet.pdf",
        "doc_type": "spec_sheet",
        "page_count": 1,
        "parse_status": "parsed",
        "bound_record_count": 1,
        "first_seen_at": now,
        "content_hash": "demo_hash_8675309",
        "source_url": None,
        "fetched_at": now,
        "effective_date": None,
        "parse_quality": 0.99,
        "has_text_layer": True,
        "used_ocr": False,
        "pages": [
            {
                "n": 1,
                "width_px": 850,
                "height_px": 1100,
                "dpi": 72
            }
        ],
        "regions_summary": {
            "table_count": 1,
            "row_count": 5
        }
    }

# --- THE NEW IMAGE ENDPOINT ---
@router.get("/{document_version_id}/pages/{page}/image")
def get_document_page_image(document_version_id: str, page: int):
    # Find the absolute path to your real image file
    current_dir = os.getcwd() # This is your backend folder
    image_path = os.path.abspath(os.path.join(
        current_dir, "..", "frontend", "public", "mock", "pages", document_version_id, f"{page}.png"
    ))
    
    # Check if the file is actually there
    if not os.path.exists(image_path):
        raise HTTPException(status_code=404, detail=f"Image not found at {image_path}")
        
    # Send the REAL image to the frontend!
    return FileResponse(image_path)
