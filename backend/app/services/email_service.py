from email.message import EmailMessage
import smtplib
import ssl

import certifi

from app.core.config import settings


class EmailConfigurationError(RuntimeError):
    pass


class EmailDeliveryError(RuntimeError):
    pass


class EmailService:
    def send_password_reset_otp(self, *, to_email: str, otp: str) -> None:
        if not settings.smtp_configured:
            raise EmailConfigurationError("SMTP settings are not configured.")

        message = EmailMessage()
        message["Subject"] = "Your IMS password reset code"
        message["From"] = settings.smtp_from_email
        message["To"] = to_email
        message.set_content(self._text_body(otp))
        message.add_alternative(self._html_body(otp), subtype="html")

        try:
            context = ssl.create_default_context(cafile=certifi.where())
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as smtp:
                smtp.starttls(context=context)
                smtp.login(settings.smtp_username, settings.smtp_password)
                smtp.send_message(message)
        except Exception as exc:
            raise EmailDeliveryError("Password reset email could not be sent.") from exc

    @staticmethod
    def _text_body(otp: str) -> str:
        return (
            "IMS password reset\n\n"
            f"Your one-time password reset code is: {otp}\n\n"
            "This code expires in 10 minutes and can be used only once. "
            "If you did not request a password reset, ignore this email."
        )

    @staticmethod
    def _html_body(otp: str) -> str:
        return f"""
        <!doctype html>
        <html>
          <body style="margin:0;background:#f8fafc;font-family:Inter,Arial,sans-serif;color:#0f172a;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:32px;">
              <tr>
                <td align="center">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border:1px solid #e2e8f0;">
                    <tr>
                      <td style="padding:28px 32px;border-bottom:1px solid #e2e8f0;">
                        <div style="font-size:18px;font-weight:700;letter-spacing:-0.02em;">IMS Inventory Cloud</div>
                        <div style="margin-top:4px;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.14em;">Password reset</div>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:32px;">
                        <h1 style="margin:0;font-size:22px;line-height:1.3;">Use this verification code</h1>
                        <p style="margin:12px 0 0;color:#475569;font-size:14px;line-height:1.7;">
                          Enter this one-time code in IMS to continue resetting your password.
                        </p>
                        <div style="margin:28px 0;padding:18px 20px;background:#f1f5f9;border:1px solid #e2e8f0;text-align:center;font-size:32px;font-weight:700;letter-spacing:0.22em;">
                          {otp}
                        </div>
                        <p style="margin:0;color:#475569;font-size:14px;line-height:1.7;">
                          This code expires in <strong>10 minutes</strong> and can be used only once.
                        </p>
                        <p style="margin:16px 0 0;color:#64748b;font-size:13px;line-height:1.7;">
                          If you did not request this reset, you can safely ignore this email.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
        </html>
        """
