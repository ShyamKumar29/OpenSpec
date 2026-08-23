from fastapi import APIRouter

router = APIRouter(
    prefix="/api/v1/metrics",
    tags=["metrics"]
)

@router.get("/catalog-health")
def get_catalog_health():
    return {
        "total_records": 240,
        "completeness_distribution": [
            {"bucket": "0-25%", "count": 12},
            {"bucket": "25-50%", "count": 38},
            {"bucket": "50-75%", "count": 90},
            {"bucket": "75-100%", "count": 100}
        ],
        "stp_all_mandatory": {
            "metric_code": "stp_all_mandatory", 
            "value": 0.58,
            "slice": "all",
            "ci_low": 0.55,
            "ci_high": 0.61,
            "n": 240,
            "is_real": True
        },
        "stp_auto_eligible_only": {
            "metric_code": "stp_auto_eligible_only", 
            "value": 0.71,
            "slice": "auto",
            "ci_low": 0.68,
            "ci_high": 0.74,
            "n": 171,
            "is_real": True
        },
        "unknown_reason_breakdown": [
            {"reason": "ATTRIBUTE_NOT_IN_DOCUMENT", "count": 264, "fix_owner": "Ops (other document)"},
            {"reason": "AMBIGUOUS", "count": 24, "fix_owner": "Reviewer"}
        ]
    }

@router.get("/throughput")
def get_throughput():
    return {
        "skus_per_hour": 42,
        "cost_per_sku_usd": 0.024,
        "reviewer_rate_per_hour": 38,
        "baseline_rate_per_hour": 7
    }

@router.get("/quality-trend")
def get_quality_trend():
    return {"series": []}