from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.services.analytics_service import analytics_service
from app.schemas.schemas import DashboardStatsResponse

router = APIRouter()


@router.get("/dashboard", response_model=DashboardStatsResponse)
def get_dashboard(db: Session = Depends(get_db)):
    return analytics_service.get_dashboard_stats(db)
