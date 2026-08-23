from fastapi import APIRouter
from datetime import datetime

router = APIRouter(prefix="/api/v1/attributes", tags=["attributes"])

@router.get("/{attribute_id}/explain")
def get_attribute_explanation(attribute_id: str):
    
    # 1. Base Evidence (for the inner attribute_value)
    base_evidence = {
        "document_version_id": "doc_demo_v1",
        "page": 1,
        "region_id": "region_1",
        "char_start": 0,
        "char_end": 5,
        "snippet_text": "600 PSI",
        "bbox": [0.50, 0.77, 0.65, 0.81]
    }
    
    # 2. Explain Evidence (for the outer wrapper - requires display context)
    explain_evidence = {
        **base_evidence,
        "document_title": "Technical Specification Sheet.pdf",
        "context_shown": {
            "column_header": "Specifications",
            "table_caption": None
        }
    }
    
    # 3. Verification Block
    verification = {
        "verdict": "ENTAILED",
        "deterministic_check": "exact",
        "rationale": "The extracted value exactly matches the document evidence.",
        "verifier_model": "gpt-4-turbo"
    }

    # 4. The Perfect Payload
    return {
        "attribute_value": {
            "id": attribute_id,
            "attribute": {
                "code": "pressure_rating",
                "name": "Pressure Rating",
                "datatype": "string",
                "risk_tier": 1,
                "is_mandatory": False
            },
            "status": "ACCEPTED",
            "value_display": "Demo Value",
            "value_canonical": {},
            "value_raw": "Demo Value",
            "unknown_reason": None,
            "provenance_kind": "EXTRACTED",
            "confidence": 0.99,
            "evidence": [base_evidence],
            "verification": verification,
            "created_at": datetime.utcnow().isoformat() + "Z"
        },
        "evidence": [explain_evidence],
        "verification": verification,
        "validation": [
            {
                "rule_id": "val_rule_1",
                "description": "Value must be a string",
                "passed": True
            }
        ],
        "transform_chain": [
            {
                "seq": 1,
                "rule_id": "tx_rule_1",
                "input_value": "Demo Value",
                "output_value": "Demo Value",
                "note": "Identity transformation"
            }
        ],
        "confidence_signals": {
            "document_binding_confidence": 0.99,
            "row_binding_confidence": 0.99,
            "parse_quality": 0.99,
            "span_containment": "exact",
            "verification_verdict": "pass",
            "validation_result": "pass",
            "provenance_kind": "EXTRACTED",
            "class_confidence": 0.99,
            "attribute_historical_precision": 0.99
        },
        "policy": {
            "tier": 1,
            "note": "Standard extraction policy applied"
        },
        "status": "ACCEPTED"
    }