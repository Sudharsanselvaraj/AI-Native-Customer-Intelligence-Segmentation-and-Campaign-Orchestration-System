from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.services.analytics_service import analytics_service
from app.services.ai_service import ai_service
from app.schemas.schemas import DashboardStatsResponse

router = APIRouter()


@router.get("/dashboard", response_model=DashboardStatsResponse)
def get_dashboard(db: Session = Depends(get_db)):
    return analytics_service.get_dashboard_stats(db)


@router.get("/insights")
def get_insights(db: Session = Depends(get_db)):
    """AI-generated insights from current analytics state."""
    stats = analytics_service.get_dashboard_stats(db)
    insights = ai_service.generate_insights(stats)
    return {"insights": insights, "generated_from": {
        "total_customers": stats["total_customers"],
        "total_campaigns": stats["total_campaigns"],
        "avg_open_rate": stats["avg_open_rate"],
    }}
