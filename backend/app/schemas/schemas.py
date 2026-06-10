from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional, List, Any, Dict
from datetime import datetime
from enum import Enum


# ── Enums ──────────────────────────────────────────────────────────────────────

class GenderEnum(str, Enum):
    MALE = "male"
    FEMALE = "female"
    OTHER = "other"


class CampaignStatusEnum(str, Enum):
    DRAFT = "draft"
    SCHEDULED = "scheduled"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class CommunicationStatusEnum(str, Enum):
    PENDING = "pending"
    SENT = "sent"
    DELIVERED = "delivered"
    FAILED = "failed"


class EventTypeEnum(str, Enum):
    SENT = "SENT"
    DELIVERED = "DELIVERED"
    FAILED = "FAILED"
    OPENED = "OPENED"
    READ = "READ"
    CLICKED = "CLICKED"
    CONVERTED = "CONVERTED"


class ChannelEnum(str, Enum):
    WHATSAPP = "whatsapp"
    EMAIL = "email"
    SMS = "sms"
    RCS = "rcs"


# ── Customer ───────────────────────────────────────────────────────────────────

class CustomerBase(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None
    city: Optional[str] = None
    gender: Optional[GenderEnum] = None
    age: Optional[int] = None


class CustomerCreate(CustomerBase):
    pass


class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    city: Optional[str] = None
    gender: Optional[GenderEnum] = None
    age: Optional[int] = None


class CustomerResponse(CustomerBase):
    id: str
    created_at: datetime
    total_orders: Optional[int] = 0
    total_spent: Optional[float] = 0.0
    last_purchase_date: Optional[datetime] = None

    class Config:
        from_attributes = True


class CustomerListResponse(BaseModel):
    items: List[CustomerResponse]
    total: int
    page: int
    size: int
    pages: int


# ── Order ──────────────────────────────────────────────────────────────────────

class OrderBase(BaseModel):
    customer_id: str
    amount: float
    category: Optional[str] = None
    purchase_date: datetime


class OrderCreate(OrderBase):
    pass


class OrderResponse(OrderBase):
    id: str
    created_at: datetime

    class Config:
        from_attributes = True


# ── Segment ────────────────────────────────────────────────────────────────────

class SegmentQueryDefinition(BaseModel):
    natural_language: Optional[str] = None
    generated_sql: Optional[str] = None
    filters: Optional[Dict[str, Any]] = None


class SegmentCreate(BaseModel):
    name: str
    description: Optional[str] = None
    query_definition: SegmentQueryDefinition
    is_smart: bool = False


class SegmentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class SegmentResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    query_definition: Dict[str, Any]
    estimated_size: Optional[int]
    is_smart: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class NLSegmentRequest(BaseModel):
    natural_language: str = Field(..., min_length=5)
    name: Optional[str] = None


class NLSegmentResponse(BaseModel):
    name: str
    description: str
    generated_sql: str
    estimated_size: int
    expected_revenue: float
    segment_id: Optional[str] = None


# ── Campaign ───────────────────────────────────────────────────────────────────

class CampaignCreate(BaseModel):
    name: str
    description: Optional[str] = None
    channel: ChannelEnum
    segment_id: str
    message_template: str
    scheduled_at: Optional[datetime] = None


class CampaignGenerateRequest(BaseModel):
    prompt: str = Field(..., min_length=10)
    segment_id: Optional[str] = None


class CampaignGenerateResponse(BaseModel):
    name: str
    description: str
    message_template: str
    channel: ChannelEnum
    channel_confidence: float
    channel_reasoning: str
    expected_engagement: float
    expected_conversion: float
    target_segment_suggestion: Optional[str] = None


class CampaignUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    message_template: Optional[str] = None
    scheduled_at: Optional[datetime] = None


class CampaignResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    channel: ChannelEnum
    segment_id: str
    segment_name: Optional[str] = None
    status: CampaignStatusEnum
    message_template: str
    ai_generated: bool
    expected_engagement: Optional[float]
    expected_conversion: Optional[float]
    scheduled_at: Optional[datetime]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    analytics: Optional["CampaignAnalyticsResponse"] = None

    class Config:
        from_attributes = True


# ── Analytics ──────────────────────────────────────────────────────────────────

class CampaignAnalyticsResponse(BaseModel):
    campaign_id: str
    total_sent: int
    total_delivered: int
    total_failed: int
    total_opened: int
    total_read: int
    total_clicked: int
    total_converted: int
    total_revenue: float
    delivery_rate: float
    open_rate: float
    click_rate: float
    conversion_rate: float
    updated_at: datetime

    class Config:
        from_attributes = True


class DashboardStatsResponse(BaseModel):
    total_customers: int
    total_revenue: float
    total_campaigns: int
    total_messages_sent: int
    avg_delivery_rate: float
    avg_open_rate: float
    avg_ctr: float
    avg_conversion_rate: float
    revenue_trend: List[Dict[str, Any]]
    campaign_performance: List[Dict[str, Any]]
    channel_breakdown: List[Dict[str, Any]]
    top_segments: List[Dict[str, Any]]


# ── Communication & Events ─────────────────────────────────────────────────────

class CommunicationEventCreate(BaseModel):
    communication_id: str
    event_type: EventTypeEnum
    metadata: Optional[Dict[str, Any]] = None


class CommunicationResponse(BaseModel):
    id: str
    campaign_id: str
    customer_id: str
    message: str
    status: CommunicationStatusEnum
    channel: ChannelEnum
    sent_at: Optional[datetime]
    idempotency_key: str

    class Config:
        from_attributes = True


# ── Webhook Callback ───────────────────────────────────────────────────────────

class WebhookCallback(BaseModel):
    communication_id: str
    event_type: EventTypeEnum
    event_time: datetime
    metadata: Optional[Dict[str, Any]] = None


class BulkWebhookCallback(BaseModel):
    events: List[WebhookCallback]


# ── AI Copilot ─────────────────────────────────────────────────────────────────

class CopilotMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class CopilotRequest(BaseModel):
    message: str
    conversation_history: List[CopilotMessage] = []
    session_id: Optional[str] = None


class CopilotResponse(BaseModel):
    message: str
    actions_taken: List[Dict[str, Any]] = []
    session_id: str


# ── Channel Recommendation ─────────────────────────────────────────────────────

class ChannelRecommendationRequest(BaseModel):
    segment_id: str
    campaign_goal: str


class ChannelRecommendationResponse(BaseModel):
    recommended_channel: ChannelEnum
    confidence: float
    reasoning: str
    alternatives: List[Dict[str, Any]]


# ── CSV Import ─────────────────────────────────────────────────────────────────

class ImportResponse(BaseModel):
    imported: int
    skipped: int
    errors: List[str]


CampaignResponse.model_rebuild()
