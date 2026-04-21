import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import aiosmtplib

from app.config import settings

logger = logging.getLogger(__name__)


async def send_survey_code(to_email: str, code: str) -> None:
    if not settings.smtp_host:
        logger.warning("SMTP nie skonfigurowany — kod %s nie zostanie wysłany na %s", code, to_email)
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Twój kod rabatowy — dziękujemy za wypełnienie ankiety!"
    msg["From"] = settings.smtp_from or settings.smtp_username or "noreply@ankiety"
    msg["To"] = to_email

    text_body = f"""\
Dziękujemy za wypełnienie ankiety!

Twój kod rabatowy:

  {code}

Okaż go przy kolejnej wizycie, aby skorzystać z nagrody.

Pozdrawiamy,
Zespół restauracji
"""

    html_body = f"""\
<!DOCTYPE html>
<html lang="pl">
<head><meta charset="UTF-8"></head>
<body style="font-family: sans-serif; background: #f9fafb; padding: 2rem;">
  <div style="max-width: 480px; margin: 0 auto; background: #fff; border-radius: 12px;
              padding: 2rem; box-shadow: 0 2px 16px rgba(0,0,0,0.08);">
    <h1 style="font-size: 1.4rem; color: #111827; margin-bottom: 0.5rem;">
      Dziękujemy za Twoją opinię!
    </h1>
    <p style="color: #6b7280; margin-bottom: 1.5rem;">
      Twój kod rabatowy do wykorzystania przy kolejnej wizycie:
    </p>
    <div style="background: #f0fdf4; border: 2px dashed #16a34a; border-radius: 10px;
                padding: 1.5rem; text-align: center; margin-bottom: 1.5rem;">
      <span style="font-size: 2rem; font-weight: 800; letter-spacing: 0.15em; color: #15803d;">
        {code}
      </span>
    </div>
    <p style="color: #6b7280; font-size: 0.875rem;">
      Okaż ten kod obsłudze przy następnej wizycie, aby skorzystać z nagrody.
    </p>
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 1.5rem 0;">
    <p style="color: #9ca3af; font-size: 0.75rem; text-align: center;">
      Wiadomość wygenerowana automatycznie — prosimy na nią nie odpowiadać.
    </p>
  </div>
</body>
</html>
"""

    msg.attach(MIMEText(text_body, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    use_ssl = settings.smtp_port == 465
    try:
        await aiosmtplib.send(
            msg,
            hostname=settings.smtp_host,
            port=settings.smtp_port,
            username=settings.smtp_username,
            password=settings.smtp_password,
            use_tls=use_ssl,
            start_tls=(settings.smtp_tls and not use_ssl),
        )
        logger.info("Email z kodem %s wysłany na %s", code, to_email)
    except Exception:
        logger.exception("Błąd wysyłania emaila na %s", to_email)
