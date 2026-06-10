from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"
    CRM_RECEIPT_URL: str = "http://localhost:8000"

    class Config:
        env_file = ".env"


settings = Settings()
