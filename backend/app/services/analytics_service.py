from sqlalchemy.orm import Session
from sqlalchemy import func, text
from typing import List, Dict, Any
from datetime import datetime, timedelta, timezone

from app.models.models import (
    Customer, Order, Campaign, Communication, CommunicationEvent,
    CampaignAnalytics, EventTypeEnum, CampaignStatusEnum
)


class AnalyticsService:
    def get_dashboard_stats(self, db: Session) -> Dict[str, Any]:
        total_customers = db.query(func.count(Customer.id)).scalar() or 0
        total_revenue = db.query(func.sum(Order.amount)).scalar() or 0.0
        total_campaigns = db.query(func.count(Campaign.id)).scalar() or 0

        total_sent = db.query(func.sum(CampaignAnalytics.total_sent)).scalar() or 0
        avg_delivery = db.query(func.avg(CampaignAnalytics.delivery_rate)).scalar() or 0.0
        avg_open = db.query(func.avg(CampaignAnalytics.open_rate)).scalar() or 0.0
        avg_ctr = db.query(func.avg(CampaignAnalytics.click_rate)).scalar() or 0.0
        avg_conv = db.query(func.avg(CampaignAnalytics.conversion_rate)).scalar() or 0.0

        revenue_trend = self._revenue_trend(db)
        campaign_perf = self._campaign_performance(db)
        channel_breakdown = self._channel_breakdown(db)

        return {
            "total_customers": total_customers,
            "total_revenue": float(total_revenue),
            "total_campaigns": total_campaigns,
            "total_messages_sent": int(total_sent),
            "avg_delivery_rate": round(float(avg_delivery), 4),
            "avg_open_rate": round(float(avg_open), 4),
            "avg_ctr": round(float(avg_ctr), 4),
            "avg_conversion_rate": round(float(avg_conv), 4),
            "revenue_trend": revenue_trend,
            "campaign_performance": campaign_perf,
            "channel_breakdown": channel_breakdown,
            "top_segments": self._top_segments(db),
        }

    def _revenue_trend(self, db: Session) -> List[Dict]:
        rows = db.execute(text("""
            SELECT DATE_TRUNC('day', purchase_date) as day,
                   SUM(amount) as revenue,
                   COUNT(*) as orders
            FROM orders
            WHERE purchase_date >= NOW() - INTERVAL '30 days'
            GROUP BY 1 ORDER BY 1
        """)).fetchall()
        return [{"date": str(r[0])[:10], "revenue": float(r[1]), "orders": r[2]} for r in rows]

    def _campaign_performance(self, db: Session) -> List[Dict]:
        rows = db.execute(text("""
            SELECT c.name, ca.total_sent, ca.total_delivered, ca.total_clicked,
                   ca.delivery_rate, ca.click_rate, ca.conversion_rate, c.channel
            FROM campaigns c
            JOIN campaign_analytics ca ON ca.campaign_id = c.id
            WHERE ca.total_sent > 0
            ORDER BY ca.total_sent DESC LIMIT 10
        """)).fetchall()
        return [
            {
                "name": r[0], "sent": r[1], "delivered": r[2], "clicked": r[3],
                "delivery_rate": float(r[4]), "click_rate": float(r[5]),
                "conversion_rate": float(r[6]), "channel": r[7],
            }
            for r in rows
        ]

    def _channel_breakdown(self, db: Session) -> List[Dict]:
        rows = db.execute(text("""
            SELECT c.channel,
                   COUNT(comm.id) as total,
                   SUM(ca.total_delivered) as delivered,
                   SUM(ca.total_clicked) as clicked
            FROM campaigns c
            JOIN campaign_analytics ca ON ca.campaign_id = c.id
            LEFT JOIN communications comm ON comm.campaign_id = c.id
            GROUP BY c.channel
        """)).fetchall()
        return [
            {"channel": r[0], "total": r[1], "delivered": int(r[2] or 0), "clicked": int(r[3] or 0)}
            for r in rows
        ]

    def _top_segments(self, db: Session) -> List[Dict]:
        from app.models.models import Segment
        rows = db.execute(text("""
            SELECT s.name, s.estimated_size, COUNT(c.id) as campaign_count
            FROM segments s
            LEFT JOIN campaigns c ON c.segment_id = s.id
            GROUP BY s.id, s.name, s.estimated_size
            ORDER BY s.estimated_size DESC NULLS LAST LIMIT 5
        """)).fetchall()
        return [{"name": r[0], "size": r[1] or 0, "campaigns": r[2]} for r in rows]

    def update_campaign_analytics(self, db: Session, campaign_id: str):
        """Recompute and persist analytics for a single campaign."""
        stats = db.execute(text("""
            SELECT
                SUM(CASE WHEN e.event_type = 'SENT' THEN 1 ELSE 0 END) AS sent,
                SUM(CASE WHEN e.event_type = 'DELIVERED' THEN 1 ELSE 0 END) AS delivered,
                SUM(CASE WHEN e.event_type = 'FAILED' THEN 1 ELSE 0 END) AS failed,
                SUM(CASE WHEN e.event_type = 'OPENED' THEN 1 ELSE 0 END) AS opened,
                SUM(CASE WHEN e.event_type = 'READ' THEN 1 ELSE 0 END) AS read_count,
                SUM(CASE WHEN e.event_type = 'CLICKED' THEN 1 ELSE 0 END) AS clicked,
                SUM(CASE WHEN e.event_type = 'CONVERTED' THEN 1 ELSE 0 END) AS converted
            FROM communication_events e
            JOIN communications c ON c.id = e.communication_id
            WHERE c.campaign_id = :cid
        """), {"cid": campaign_id}).fetchone()

        sent = int(stats[0] or 0)
        delivered = int(stats[1] or 0)
        failed = int(stats[2] or 0)
        opened = int(stats[3] or 0)
        read_c = int(stats[4] or 0)
        clicked = int(stats[5] or 0)
        converted = int(stats[6] or 0)

        delivery_rate = delivered / sent if sent else 0.0
        open_rate = opened / delivered if delivered else 0.0
        click_rate = clicked / delivered if delivered else 0.0
        conversion_rate = converted / clicked if clicked else 0.0

        ca = db.query(CampaignAnalytics).filter(CampaignAnalytics.campaign_id == campaign_id).first()
        if not ca:
            ca = CampaignAnalytics(campaign_id=campaign_id)
            db.add(ca)

        ca.total_sent = sent
        ca.total_delivered = delivered
        ca.total_failed = failed
        ca.total_opened = opened
        ca.total_read = read_c
        ca.total_clicked = clicked
        ca.total_converted = converted
        ca.delivery_rate = delivery_rate
        ca.open_rate = open_rate
        ca.click_rate = click_rate
        ca.conversion_rate = conversion_rate
        db.commit()


analytics_service = AnalyticsService()
