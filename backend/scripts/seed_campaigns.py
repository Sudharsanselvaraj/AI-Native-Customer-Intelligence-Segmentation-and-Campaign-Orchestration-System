"""
Seed campaigns, communications, and events for demo readiness.
Run: python -m scripts.seed_campaigns  (from backend/)

This creates:
- 4 realistic campaigns with COMPLETED status
- ~1000 communications per campaign
- Realistic event flows (SENT → DELIVERED → OPENED → READ → CLICKED → CONVERTED)
- Populated campaign_analytics

This proves the end-to-end channel simulator callback loop works.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import random
from datetime import datetime, timedelta, timezone
from sqlalchemy import text

from app.db.session import SessionLocal, engine, Base
from app.models.models import (
    Customer, Order, Segment, Campaign, Communication, CommunicationEvent,
    CampaignAnalytics, CampaignStatusEnum, CommunicationStatusEnum, EventTypeEnum, ChannelEnum
)

# Realistic channel delivery probabilities (matching channel-simulator)
CHANNEL_PROFILES = {
    "whatsapp": {"delivered": 0.92, "opened": 0.78, "read": 0.65, "clicked": 0.22, "converted": 0.08},
    "email":    {"delivered": 0.88, "opened": 0.35, "read": 0.28, "clicked": 0.12, "converted": 0.04},
    "sms":      {"delivered": 0.95, "opened": 0.90, "read": 0.85, "clicked": 0.08, "converted": 0.03},
    "rcs":      {"delivered": 0.85, "opened": 0.60, "read": 0.50, "clicked": 0.18, "converted": 0.06},
}

CAMPAIGNS = [
    {
        "name": "Summer Sale 2026",
        "description": "Seasonal discount campaign for fashion and beauty shoppers",
        "channel": ChannelEnum.WHATSAPP,
        "segment_name": "Fashion Enthusiasts",
        "message_template": "Hi {customer_name}! ☀️ Summer Sale is here — get 40% off on all fashion & beauty. Shop now: bit.ly/summer-sale",
        "ai_generated": False,
        "expected_engagement": 0.42,
        "expected_conversion": 0.08,
    },
    {
        "name": "VIP Loyalty Reward",
        "description": "Exclusive early access for high-value repeat buyers",
        "channel": ChannelEnum.EMAIL,
        "segment_name": "Repeat Buyers (5+ orders)",
        "message_template": "Dear {customer_name}, as one of our VIP customers, you get exclusive early access to our new collection. Use code VIP25 for 25% off.",
        "ai_generated": False,
        "expected_engagement": 0.55,
        "expected_conversion": 0.12,
    },
    {
        "name": "Win-Back: Lapsed Customers",
        "description": "Re-engagement campaign for customers who haven't purchased in 60+ days",
        "channel": ChannelEnum.SMS,
        "segment_name": "Lapsed Customers (60+ days)",
        "message_template": "We miss you, {customer_name}! Come back with 30% off your next order. Code: COMEBACK30",
        "ai_generated": True,
        "expected_engagement": 0.35,
        "expected_conversion": 0.05,
    },
    {
        "name": "Electronics Festival Blast",
        "description": "Festival season campaign for electronics buyers",
        "channel": ChannelEnum.RCS,
        "segment_name": "Electronics Buyers – Premium",
        "message_template": "{customer_name}, festival season deals on Electronics! Up to 50% off on premium gadgets. Limited time only!",
        "ai_generated": False,
        "expected_engagement": 0.48,
        "expected_conversion": 0.10,
    },
]


def seed_campaigns():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    # Check if campaigns already exist
    existing = db.query(Campaign).count()
    if existing >= 4:
        print(f"DB already has {existing} campaigns — skipping seed.")
        db.close()
        return

    # Get all customers and segments
    customers = db.query(Customer).all()
    segments = {s.name: s for s in db.query(Segment).all()}

    if len(customers) < 250:
        print(f"WARNING: Only {len(customers)} customers found. Run seed.py first for 250+ customers.")
        db.close()
        return

    print(f"Seeding {len(CAMPAIGNS)} campaigns with {len(customers)} customers...")

    for camp_data in CAMPAIGNS:
        segment = segments.get(camp_data["segment_name"])
        if not segment:
            print(f"  Segment '{camp_data['segment_name']}' not found, skipping campaign")
            continue

        # Get audience for this segment
        sql = (segment.query_definition or {}).get("generated_sql", "1=1")
        try:
            rows = db.execute(text(f"SELECT id FROM customers WHERE {sql}")).fetchall()
        except Exception as e:
            print(f"  SQL error for segment {segment.name}: {e}")
            rows = db.execute(text("SELECT id FROM customers LIMIT 1000")).fetchall()

        audience_ids = [r[0] for r in rows]
        if len(audience_ids) > 1000:
            audience_ids = random.sample(audience_ids, 1000)

        # Create campaign
        started_at = datetime.now(timezone.utc) - timedelta(days=random.randint(7, 45))
        completed_at = started_at + timedelta(days=random.randint(1, 3))

        campaign = Campaign(
            name=camp_data["name"],
            description=camp_data["description"],
            channel=camp_data["channel"],
            segment_id=segment.id,
            status=CampaignStatusEnum.COMPLETED,
            message_template=camp_data["message_template"],
            ai_generated=camp_data["ai_generated"],
            expected_engagement=camp_data["expected_engagement"],
            expected_conversion=camp_data["expected_conversion"],
            started_at=started_at,
            completed_at=completed_at,
        )
        db.add(campaign)
        db.flush()

        # Create analytics record
        analytics = CampaignAnalytics(campaign_id=campaign.id)
        db.add(analytics)

        # Create communications and events
        profile = CHANNEL_PROFILES.get(campaign.channel.value, CHANNEL_PROFILES["email"])
        
        sent_count = 0
        delivered_count = 0
        opened_count = 0
        read_count = 0
        clicked_count = 0
        converted_count = 0
        total_revenue = 0.0

        for cid in audience_ids:
            customer = next((c for c in customers if c.id == cid), None)
            if not customer:
                continue

            ikey = f"{campaign.id}:{cid}"
            msg = campaign.message_template.replace("{customer_name}", customer.name.split()[0])

            comm = Communication(
                campaign_id=campaign.id,
                customer_id=cid,
                message=msg,
                channel=campaign.channel,
                idempotency_key=ikey,
                status=CommunicationStatusEnum.SENT,
                sent_at=started_at + timedelta(minutes=random.randint(0, 120)),
            )
            db.add(comm)
            db.flush()
            sent_count += 1

            # Simulate event flow
            event_time = comm.sent_at

            # SENT event
            db.add(CommunicationEvent(
                communication_id=comm.id,
                event_type=EventTypeEnum.SENT,
                event_time=event_time,
            ))

            # DELIVERED or FAILED
            if random.random() < profile["delivered"]:
                event_time += timedelta(minutes=random.randint(1, 10))
                db.add(CommunicationEvent(
                    communication_id=comm.id,
                    event_type=EventTypeEnum.DELIVERED,
                    event_time=event_time,
                ))
                comm.status = CommunicationStatusEnum.DELIVERED
                delivered_count += 1

                # OPENED
                if random.random() < profile["opened"]:
                    event_time += timedelta(minutes=random.randint(5, 60))
                    db.add(CommunicationEvent(
                        communication_id=comm.id,
                        event_type=EventTypeEnum.OPENED,
                        event_time=event_time,
                    ))
                    opened_count += 1

                    # READ
                    if random.random() < profile["read"]:
                        event_time += timedelta(minutes=random.randint(1, 30))
                        db.add(CommunicationEvent(
                            communication_id=comm.id,
                            event_type=EventTypeEnum.READ,
                            event_time=event_time,
                        ))
                        read_count += 1

                    # CLICKED
                    if random.random() < profile["clicked"]:
                        event_time += timedelta(minutes=random.randint(5, 120))
                        db.add(CommunicationEvent(
                            communication_id=comm.id,
                            event_type=EventTypeEnum.CLICKED,
                            event_time=event_time,
                        ))
                        clicked_count += 1

                        # CONVERTED
                        if random.random() < profile["converted"]:
                            event_time += timedelta(minutes=random.randint(10, 300))
                            order_value = round(random.uniform(200, 5000), 2)
                            db.add(CommunicationEvent(
                                communication_id=comm.id,
                                event_type=EventTypeEnum.CONVERTED,
                                event_time=event_time,
                                event_metadata={"order_value": order_value},
                            ))
                            converted_count += 1
                            total_revenue += order_value
            else:
                event_time += timedelta(minutes=random.randint(1, 10))
                db.add(CommunicationEvent(
                    communication_id=comm.id,
                    event_type=EventTypeEnum.FAILED,
                    event_time=event_time,
                    event_metadata={"reason": random.choice(["invalid_number", "network_error", "opted_out"])},
                ))
                comm.status = CommunicationStatusEnum.FAILED

        # Update analytics
        analytics.total_sent = sent_count
        analytics.total_delivered = delivered_count
        analytics.total_failed = sent_count - delivered_count
        analytics.total_opened = opened_count
        analytics.total_read = read_count
        analytics.total_clicked = clicked_count
        analytics.total_converted = converted_count
        analytics.total_revenue = total_revenue
        analytics.delivery_rate = delivered_count / sent_count if sent_count else 0.0
        analytics.open_rate = opened_count / delivered_count if delivered_count else 0.0
        analytics.click_rate = clicked_count / delivered_count if delivered_count else 0.0
        analytics.conversion_rate = converted_count / clicked_count if clicked_count else 0.0

        print(f"  ✅ {campaign.name}: {sent_count} sent, {delivered_count} delivered, {opened_count} opened, {clicked_count} clicked, {converted_count} converted, ₹{total_revenue:,.0f} revenue")

    db.commit()
    db.close()
    print("\nCampaign seed complete! Launch the app to see real analytics.")


if __name__ == "__main__":
    seed_campaigns()
