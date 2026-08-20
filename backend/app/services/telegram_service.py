import httpx
import structlog
from app.config import get_settings

settings = get_settings()
logger = structlog.get_logger()


async def send_otp(chat_id: str, otp_code: str) -> bool:
    if not settings.TELEGRAM_BOT_TOKEN:
        logger.warning("telegram_bot_token_not_configured")
        return False
    if not chat_id:
        logger.warning("telegram_chat_id_not_set")
        return False

    text = (
        f"🔐 <b>vijaykrsha.online</b>\n\n"
        f"Your verification code: <code>{otp_code}</code>\n\n"
        f"This code expires in {settings.TELEGRAM_OTP_TTL_SECONDS // 60} minutes.\n"
        f"⚠️ Do NOT share this code with anyone."
    )
    url = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML",
        "disable_web_page_preview": True,
    }
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            resp = await client.post(url, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                if data.get("ok"):
                    logger.info("otp_sent", chat_id=chat_id)
                    return True
            logger.error("otp_send_failed", status=resp.status_code, body=resp.text)
            return False
        except Exception as e:
            logger.error("otp_send_exception", error=str(e))
            return False
