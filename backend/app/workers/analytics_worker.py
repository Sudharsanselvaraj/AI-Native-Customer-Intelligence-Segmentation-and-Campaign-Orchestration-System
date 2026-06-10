import structlog
from app.core.celery_app import celery_app
from app.db.session import SessionLocal

logger = structlog.get_logger()


@celery_app.task(bind=True, max_retries=5, default_retry_delay=10, queue="analytics")
def update_campaign_analytics(self, campaign_id: str):
    db = SessionLocal()
    try:
        from app.services.analytics_service import analytics_service
        analytics_service.update_campaign_analytics(db, campaign_id)
        logger.info("analytics_updated", campaign_id=campaign_id)
    except Exception as exc:
        logger.error("analytics_update_failed", campaign_id=campaign_id, error=str(exc))
        db.rollback()
        raise self.retry(exc=exc)
    finally:
        db.close()
