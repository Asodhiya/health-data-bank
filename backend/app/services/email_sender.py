import smtplib
from email.message import EmailMessage
import os
from dotenv import load_dotenv


load_dotenv()

def send_reset_email(to_email: str, reset_link: str):
    EMAIL_USER = os.getenv("EMAIL_USER")
    EMAIL_PASS = os.getenv("EMAIL_PASS")

    if not EMAIL_USER or not EMAIL_PASS:
        raise RuntimeError("Email credentials not set")

    msg = EmailMessage()
    msg["Subject"] = "Reset your password"
    msg["From"] = f"Your App <{EMAIL_USER}>"
    msg["To"] = to_email

    msg.set_content(
        f"""
Hello,

You requested a password reset.

Click the link below to reset your password:
{reset_link}

This link will expire in 15 minutes.

If you did not request this, please ignore this email.

 Your App Team
"""
    )

    with smtplib.SMTP("smtp.gmail.com", 587) as server:
        server.starttls()
        server.login(EMAIL_USER, EMAIL_PASS)
        server.send_message(msg)