from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    gopos_client_id: str
    gopos_client_secret: str
    gopos_organization_id: str
    gopos_base_url: str = "https://app.gopos.io"

    database_url: str
    secret_key: str
    admin_username: str
    admin_password: str

    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_username: str | None = None
    smtp_password: str | None = None
    smtp_from: str | None = None
    smtp_tls: bool = True

    class Config:
        env_file = ".env"


settings = Settings()
