import logging
import asyncio
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

async def send_otp_email(email: str, otp: str):
    """Send an OTP email to the user's email address.
    
    If SMTP parameters are configured, it runs the blocking smtplib call in an async-safe thread.
    Otherwise, it logs/prints the OTP to stdout/console for local development.
    """
    subject = f"StudyVerse Password Reset OTP: {otp}"
    body = f"""Hello,

You requested a password reset for your StudyVerse account.
Your One-Time Password (OTP) is: {otp}

This OTP is valid for 10 minutes. If you did not request this, please ignore this email.

Best regards,
The StudyVerse Team
"""

    if settings.SMTP_HOST and settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
        try:
            await asyncio.to_thread(_send_smtp, email, subject, body)
            logger.info(f"Successfully sent reset email to {email} via SMTP.")
            return
        except Exception as e:
            logger.error(f"Failed to send email via SMTP: {e}. Falling back to console logging.")
    
    # Dev fallback - print in a highly visible box
    print("\n" + "="*50)
    print("                MOCK EMAIL DISPATCH")
    print(f"To:      {email}")
    print(f"Subject: {subject}")
    print("-"*50)
    print(body.strip())
    print("="*50 + "\n")

def _send_smtp(email: str, subject: str, body: str):
    msg = MIMEMultipart()
    msg['From'] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
    msg['To'] = email
    msg['Subject'] = subject
    msg.attach(MIMEText(body, 'plain'))
    
    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
        if settings.SMTP_PORT == 587:
            server.starttls()
        server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
        server.send_message(msg)
