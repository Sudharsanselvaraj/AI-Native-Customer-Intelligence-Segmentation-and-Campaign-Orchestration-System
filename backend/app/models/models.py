import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Integer, Float, DateTime, ForeignKey,
    Text, Enum as SAEnum, Boolean, JSON, Index
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

from app.db.session import Base


def gen_uuid():
    return str(uuid.uuid4())


class GenderEnum(str, enum.Enum):
    MALE = "male"
    FEMALE = "female"
    OTHER = "other"


class CampaignStatusEnum(str, enum.Enum):
    DRAFT = "draft"
    SCHEDULED = "scheduled"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class CommunicationStatusEnum(str, enum.Enum):
    PENDING = "pending"
    SENT = "sent"
    DELIVERED = "delivered"
    FAILED = "failed"


class EventTypeEnum(str, enum.Enum):
    SENT = "SENT"
    DELIVERED = "DELIVERED"
    FAILED = "FAILED"
    OPENED = "OPENED"
    READ = "READ"
    CLICKED = "CLICKED"
    CONVERTED = "CONVERTED"


class ChannelEnum(str, enum.Enum):
    WHATSAPP = "whatsapp"
    EMAIL = "email"
    SMS = "sms"
    RCS = "rcs"


class Customer(Base):
    __tablename__ = "customers"

    id = Column(String, primary_key=True, default=gen_uuid)
    name = Column(String(255), nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    phone = Column(String(20), nullable=True)
    city = Column(String(100), nullable=True, index=True)
    gender = Column(SAEnum(GenderEnum), nullable=True)
    age = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    orders = relationship("Order", back_populates="customer", lazy="dynamic")
    communications = relationship("Communication", back_populates="customer", lazy="dynamic")

    __table_args__ = (
        Index("ix_customers_city_gender", "city", "gender"),
    )


class Order(Base):
    __tablename__ = "orders"

    id = Column(String, primary_key=True, default=gen_uuid)
    customer_id = Column(String, ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    amount = Column(Float, nullable=False)
    category = Column(String(100), nullable=True, index=True)
    purchase_date = Column(DateTime(timezone=True), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    customer = relationship("Customer", back_populates="orders")

    __table_args__ = (
        Index("ix_orders_customer_date", "customer_id", "purchase_date"),
        Index("ix_orders_category_date", "category", "purchase_date"),
    )


class Segment(Base):
    __tablename__ = "segments"

    id = Column(String, primary_key=True, default=gen_uuid)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    query_definition = Column(JSON, nullable=False)  # stores NL query + generated SQL
    estimated_size = Column(Integer, nullable=True)
    is_smart = Column(Boolean, default=False)  # pre-built smart segments
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    campaigns = relationship("Campaign", back_populates="segment")


class Campaign(Base):
    __tablename__ = "campaigns"

    id = Column(String, primary_key=True, default=gen_uuid)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    channel = Column(SAEnum(ChannelEnum), nullable=False)
    segment_id = Column(String, ForeignKey("segments.id"), nullable=False, index=True)
    status = Column(SAEnum(CampaignStatusEnum), default=CampaignStatusEnum.DRAFT, index=True)
    message_template = Column(Text, nullable=False)
    ai_generated = Column(Boolean, default=False)
    expected_engagement = Column(Float, nullable=True)
    expected_conversion = Column(Float, nullable=True)
    scheduled_at = Column(DateTime(timezone=True), nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    segment = relationship("Segment", back_populates="campaigns")
    communications = relationship("Communication", back_populates="campaign", lazy="dynamic")

    __table_args__ = (
        Index("ix_campaigns_status_created", "status", "created_at"),
    )


class Communication(Base):
    __tablename__ = "communications"

    id = Column(String, primary_key=True, default=gen_uuid)
    campaign_id = Column(String, ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_id = Column(String, ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    message = Column(Text, nullable=False)
    status = Column(SAEnum(CommunicationStatusEnum), default=CommunicationStatusEnum.PENDING, index=True)
    channel = Column(SAEnum(ChannelEnum), nullable=False)
    sent_at = Column(DateTime(timezone=True), nullable=True)
    idempotency_key = Column(String(255), unique=True, nullable=False)

    campaign = relationship("Campaign", back_populates="communications")
    customer = relationship("Customer", back_populates="communications")
    events = relationship("CommunicationEvent", back_populates="communication", lazy="dynamic")
    channel_logs = relationship("ChannelLog", back_populates="communication", lazy="dynamic")

    __table_args__ = (
        Index("ix_communications_campaign_status", "campaign_id", "status"),
    )


class CommunicationEvent(Base):
    __tablename__ = "communication_events"

    id = Column(String, primary_key=True, default=gen_uuid)
    communication_id = Column(String, ForeignKey("communications.id", ondelete="CASCADE"), nullable=False, index=True)
    event_type = Column(SAEnum(EventTypeEnum), nullable=False)
    event_time = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    event_metadata = Column("metadata", JSON, nullable=True)

    communication = relationship("Communication", back_populates="events")

    __table_args__ = (
        Index("ix_comm_events_comm_type", "communication_id", "event_type"),
    )


class ChannelLog(Base):
    __tablename__ = "channel_logs"

    id = Column(String, primary_key=True, default=gen_uuid)
    communication_id = Column(String, ForeignKey("communications.id", ondelete="CASCADE"), nullable=False, index=True)
    payload = Column(JSON, nullable=True)
    response = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    communication = relationship("Communication", back_populates="channel_logs")


class CampaignAnalytics(Base):
    """Materialized analytics per campaign — updated on each event callback."""
    __tablename__ = "campaign_analytics"

    id = Column(String, primary_key=True, default=gen_uuid)
    campaign_id = Column(String, ForeignKey("campaigns.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    total_sent = Column(Integer, default=0)
    total_delivered = Column(Integer, default=0)
    total_failed = Column(Integer, default=0)
    total_opened = Column(Integer, default=0)
    total_read = Column(Integer, default=0)
    total_clicked = Column(Integer, default=0)
    total_converted = Column(Integer, default=0)
    total_revenue = Column(Float, default=0.0)
    delivery_rate = Column(Float, default=0.0)
    open_rate = Column(Float, default=0.0)
    click_rate = Column(Float, default=0.0)
    conversion_rate = Column(Float, default=0.0)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    campaign = relationship("Campaign")
