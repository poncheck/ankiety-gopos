import logging
import struct
import zlib
from email.mime.image import MIMEImage
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import aiosmtplib

from app.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Code 128B encoder + minimalny generator PNG — zero zewnętrznych zależności
# ---------------------------------------------------------------------------

_C128_PATTERNS = [
    "11011001100","11001101100","11001100110","10010011000","10010001100",
    "10001001100","10011001000","10011000100","10001100100","11001001000",
    "11001000100","11000100100","10110011100","10011011100","10011001110",
    "10111001100","10011101100","10011100110","11001110010","11001011100",
    "11001001110","11011100100","11001110100","11101101110","11101001100",
    "11100101100","11100100110","11101100100","11100110100","11100110010",
    "11011011000","11011000110","11000110110","10100011000","10001011000",
    "10001000110","10110001000","10001101000","10001100010","11010001000",
    "11000101000","11000100010","10110111000","10110001110","10001101110",
    "10111011000","10111000110","10001110110","11101110110","11010001110",
    "11000101110","11011101000","11011100010","11011101110","11101011000",
    "11101000110","11100010110","11101101000","11101100010","11100011010",
    "11101111010","11001000010","11110001010","10100110000","10100001100",
    "10010110000","10010000110","10000101100","10000100110","10110010000",
    "10110000100","10011010000","10011000010","10000110100","10000110010",
    "11000010010","11001010000","11110111010","11000010100","10001111010",
    "10100111100","10010111100","10010011110","10111100100","10011110100",
    "10011110010","11110100100","11110010100","11110010010","11011011110",
    "11011110110","11110110110","10101111000","10100011110","10001011110",
    "10111101000","10111100010","11110101000","11110100010","10111011110",
    "10111101110","11101011110","11110101110","11010000100","11010010000",
    "11010011100","1100011101011",  # 106 = STOP (13 modułów)
]
_START_B = 104
_STOP    = 106


def _encode_code128b(text: str) -> str:
    """Zwraca ciąg bitów '0'/'1' dla kodu Code 128B."""
    parts = [_C128_PATTERNS[_START_B]]
    checksum = _START_B
    for i, ch in enumerate(text):
        val = ord(ch) - 32
        if val < 0 or val > 94:
            continue
        checksum += (i + 1) * val
        parts.append(_C128_PATTERNS[val])
    parts.append(_C128_PATTERNS[checksum % 103])
    parts.append(_C128_PATTERNS[_STOP])
    return "".join(parts)


def _png_chunk(tag: bytes, data: bytes) -> bytes:
    chunk = tag + data
    return struct.pack(">I", len(data)) + chunk + struct.pack(">I", zlib.crc32(chunk) & 0xFFFFFFFF)


def _barcode_png(code: str, module_px: int = 2, height: int = 80, quiet_px: int = 20) -> bytes:
    """Generuje PNG kodu kreskowego Code 128B. Zwraca bajty PNG."""
    bits = _encode_code128b(code)
    width = len(bits) * module_px + quiet_px * 2

    # Jeden wiersz pikseli (grayscale): quiet strefa + bary + quiet strefa
    row = bytearray([255] * quiet_px)
    for bit in bits:
        row.extend([0 if bit == "1" else 255] * module_px)
    row.extend([255] * quiet_px)

    # Dane obrazu: dla każdego wiersza bajt filtra (0) + piksele
    scanline = b"\x00" + bytes(row)
    raw = scanline * height
    compressed = zlib.compress(raw, 9)

    ihdr = struct.pack(">II", width, height) + bytes([8, 0, 0, 0, 0])  # 8-bit grayscale
    png  = b"\x89PNG\r\n\x1a\n"
    png += _png_chunk(b"IHDR", ihdr)
    png += _png_chunk(b"IDAT", compressed)
    png += _png_chunk(b"IEND", b"")
    return png


# ---------------------------------------------------------------------------
# Wysyłka e-maila
# ---------------------------------------------------------------------------

async def send_survey_code(to_email: str, code: str) -> None:
    if not settings.smtp_host:
        logger.warning("SMTP nie skonfigurowany — kod %s nie zostanie wysłany na %s", code, to_email)
        return

    # Generuj PNG kodu kreskowego (None = fallback do maila bez obrazka)
    try:
        barcode_png = _barcode_png(code)
    except Exception:
        logger.warning("Nie udało się wygenerować barcode PNG dla kodu %s", code)
        barcode_png = None
    cid = "barcode_img"

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
      <img src="cid:{cid}" alt="Kod kreskowy: {code}"
           style="display: block; margin: 0 auto 0.75rem; max-width: 100%; height: 80px;" />
      <span style="font-size: 1.1rem; font-weight: 700; letter-spacing: 0.15em;
                   color: #15803d; font-family: monospace;">
        {code}
      </span>
    </div>
    <p style="color: #6b7280; font-size: 0.875rem;">
      Pokaż kod kasjerowi lub zeskanuj przy kasie, aby skorzystać z nagrody.
    </p>
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 1.5rem 0;">
    <p style="color: #9ca3af; font-size: 0.75rem; text-align: center;">
      Wiadomość wygenerowana automatycznie — prosimy na nią nie odpowiadać.
    </p>
  </div>
</body>
</html>
"""

    text_body = f"""\
Dziękujemy za wypełnienie ankiety!

Twój kod rabatowy: {code}

Okaż go przy kolejnej wizycie, aby skorzystać z nagrody.

Pozdrawiamy,
Zespół restauracji
"""

    subject = "Twój kod rabatowy — dziękujemy za wypełnienie ankiety!"
    from_addr = settings.smtp_from or settings.smtp_username or "noreply@ankiety"

    if barcode_png:
        # multipart/related: HTML z osadzonym obrazkiem CID
        msg_root = MIMEMultipart("related")
        msg_root["Subject"] = subject
        msg_root["From"] = from_addr
        msg_root["To"] = to_email

        msg_alt = MIMEMultipart("alternative")
        msg_alt.attach(MIMEText(text_body, "plain", "utf-8"))
        msg_alt.attach(MIMEText(html_body, "html", "utf-8"))
        msg_root.attach(msg_alt)

        img = MIMEImage(barcode_png, "png")
        img.add_header("Content-ID", f"<{cid}>")
        img.add_header("Content-Disposition", "inline", filename="kod_rabatowy.png")
        msg_root.attach(img)
    else:
        # Fallback: zwykły multipart/alternative bez obrazka
        msg_root = MIMEMultipart("alternative")
        msg_root["Subject"] = subject
        msg_root["From"] = from_addr
        msg_root["To"] = to_email
        msg_root.attach(MIMEText(text_body, "plain", "utf-8"))
        msg_root.attach(MIMEText(html_body, "html", "utf-8"))

    use_ssl = settings.smtp_port == 465
    try:
        await aiosmtplib.send(
            msg_root,
            hostname=settings.smtp_host,
            port=settings.smtp_port,
            username=settings.smtp_username,
            password=settings.smtp_password,
            use_tls=use_ssl,
            start_tls=(settings.smtp_tls and not use_ssl),
        )
        logger.info("Email z kodem %s (+ barcode PNG) wysłany na %s", code, to_email)
    except Exception:
        logger.exception("Błąd wysyłania emaila na %s", to_email)


async def send_survey_results(
    bill_number: str,
    customer_email: str | None,
    answers: list[dict],
    code: str,
) -> None:
    """Wysyła podsumowanie wypełnionej ankiety na ADMIN_EMAIL z .env."""
    if not settings.smtp_host:
        return
    if not settings.admin_email:
        return

    from datetime import datetime
    now = datetime.now().strftime("%d.%m.%Y %H:%M")

    # Grupuj odpowiedzi per produkt
    products: dict[str, list[dict]] = {}
    for ans in answers:
        pname = ans.get("product_name") or ans.get("product_id") or "Nieznany produkt"
        products.setdefault(pname, []).append(ans)

    # Buduj HTML z tabelkami per produkt
    products_html = ""
    products_text = ""
    for pname, panswers in products.items():
        rows_html = ""
        rows_text = f"\n  {pname}\n"
        for a in panswers:
            q = a.get("question_text") or f"Pytanie #{a.get('question_id')}"
            v = a.get("value", "")
            rows_html += (
                f'<tr><td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;color:#374151;font-size:0.875rem;">{q}</td>'
                f'<td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;font-weight:600;color:#111827;font-size:0.875rem;">{v}</td></tr>'
            )
            rows_text += f"    {q}: {v}\n"
        products_html += (
            f'<div style="margin-bottom:1.25rem;">'
            f'<div style="font-size:0.8rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;margin-bottom:0.4rem;">{pname}</div>'
            f'<table style="width:100%;border-collapse:collapse;background:#f9fafb;border-radius:8px;overflow:hidden;">{rows_html}</table>'
            f'</div>'
        )
        products_text += rows_text

    customer_line = customer_email if customer_email else "— (brak)"

    html_body = (
        '<!DOCTYPE html><html lang="pl"><head><meta charset="UTF-8"></head>'
        '<body style="font-family:sans-serif;background:#f3f4f6;padding:1.5rem;">'
        '<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:2rem;box-shadow:0 2px 12px rgba(0,0,0,0.07);">'
        f'<h1 style="font-size:1.2rem;color:#111827;margin-bottom:0.25rem;">Nowa ankieta — paragon #{bill_number}</h1>'
        f'<p style="color:#6b7280;font-size:0.85rem;margin-bottom:1.5rem;">{now}</p>'
        '<table style="width:100%;border-collapse:collapse;margin-bottom:1.5rem;">'
        f'<tr><td style="padding:4px 0;color:#6b7280;font-size:0.8rem;width:140px;">Klient (e-mail)</td><td style="padding:4px 0;font-size:0.85rem;color:#111;">{customer_line}</td></tr>'
        f'<tr><td style="padding:4px 0;color:#6b7280;font-size:0.8rem;">Kod rabatowy</td><td style="padding:4px 0;font-size:0.85rem;font-family:monospace;font-weight:700;color:#15803d;">{code}</td></tr>'
        f'<tr><td style="padding:4px 0;color:#6b7280;font-size:0.8rem;">Liczba odpowiedzi</td><td style="padding:4px 0;font-size:0.85rem;color:#111;">{len(answers)}</td></tr>'
        '</table>'
        '<hr style="border:none;border-top:1px solid #e5e7eb;margin:1.25rem 0;">'
        f'{products_html}'
        '<p style="color:#9ca3af;font-size:0.75rem;text-align:center;margin-top:1.5rem;">Wiadomość automatyczna z systemu Ankiety GoPOS</p>'
        '</div></body></html>'
    )

    text_body = (
        f"Nowa ankieta — paragon #{bill_number}\n"
        f"Data: {now}\n"
        f"Klient: {customer_line}\n"
        f"Kod rabatowy: {code}\n"
        f"Liczba odpowiedzi: {len(answers)}\n\n"
        f"Odpowiedzi:{products_text}"
    )

    subject = f"Ankieta #{bill_number} — {len(answers)} odpowiedzi"
    from_addr = settings.smtp_from or settings.smtp_username or "noreply@ankiety"

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = from_addr
    msg["To"] = settings.admin_email
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
        logger.info("Wyniki ankiety #%s wysłane na %s", bill_number, settings.admin_email)
    except Exception:
        logger.exception("Błąd wysyłania wyników ankiety #%s na %s", bill_number, settings.admin_email)
