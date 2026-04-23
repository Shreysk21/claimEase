import smtplib
from email.message import EmailMessage
from typing import Optional
from uuid import UUID

from sqlalchemy.orm import Session, joinedload

from app.config.settings import (
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USERNAME,
    SMTP_PASSWORD,
    SMTP_FROM_EMAIL,
    SMTP_USE_TLS,
)
from app.models.claim_model import Claim
from app.models.notifications_model import Notification
from app.models.query_model import Query
from app.models.user_model import User

# Human-readable stage names
STAGE_NAMES = {
    1: "Employee Submission",
    2: "Scrutiny",
    3: "Medical Review",
    4: "Finance Verification",
    5: "DDO Sanction",
}


def _send_email(subject: str, recipient: str, body_text: str, body_html: str = None) -> None:
    """Send an email via SMTP. Supports optional HTML body."""
    if not SMTP_HOST or not SMTP_FROM_EMAIL or not recipient:
        print(f"[EMAIL] Skipped — missing config (SMTP_HOST={SMTP_HOST!r}, recipient={recipient!r})")
        return

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = SMTP_FROM_EMAIL
    msg["To"] = recipient
    msg.set_content(body_text)
    if body_html:
        msg.add_alternative(body_html, subtype="html")

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=30) as server:
            if SMTP_USE_TLS:
                server.starttls()
            if SMTP_USERNAME and SMTP_PASSWORD:
                server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.send_message(msg)
        print(f"[EMAIL] Sent to {recipient}: {subject}")
    except Exception as e:
        print(f"[EMAIL ERROR] Failed sending to {recipient}: {e}")
        raise


def _build_email_content(
    *,
    employee_name: str,
    claim_id: UUID,
    event_type: str,
    stage_number: int,
    message: str,
    bill_amount: float,
    approved_amount: float | None,
    patient_name: str | None,
    hospital_name: str | None,
    diagnosis: str | None,
    claim_status: str,
) -> tuple[str, str]:
    """Build plain-text and HTML email bodies with full claim details."""
    claim_short = str(claim_id)[:8].upper()
    stage_name = STAGE_NAMES.get(stage_number, f"Stage {stage_number}")
    event_label = "Query Raised" if event_type == "QUERY" else "Claim Rejected"

    # ── Plain-text version ──
    text = (
        f"Dear {employee_name},\n\n"
        f"Your medical reimbursement claim has a new update.\n\n"
        f"{'=' * 50}\n"
        f"  Event        : {event_label}\n"
        f"  Claim ID     : {claim_short}\n"
        f"  Current Stage: {stage_name}\n"
        f"  Claim Status : {claim_status}\n"
        f"  Bill Amount  : Rs. {bill_amount:,.2f}\n"
    )
    if approved_amount is not None:
        text += f"  Approved Amt : Rs. {approved_amount:,.2f}\n"
    if patient_name:
        text += f"  Patient      : {patient_name}\n"
    if hospital_name:
        text += f"  Hospital     : {hospital_name}\n"
    if diagnosis:
        text += f"  Diagnosis    : {diagnosis}\n"
    text += (
        f"{'=' * 50}\n\n"
        f"  Message from the officer:\n"
        f"  {message}\n\n"
        f"{'=' * 50}\n\n"
        f"Please login to the ClaimEase portal to view details and take action.\n\n"
        f"Regards,\n"
        f"ClaimEase — Medical Reimbursement System\n"
    )

    # ── HTML version ──
    banner_color = "#dc3545" if event_type == "REJECTION" else "#f0ad4e"
    banner_text_color = "#ffffff" if event_type == "REJECTION" else "#333333"
    event_icon = "&#10060;" if event_type == "REJECTION" else "&#10067;"

    optional_rows = ""
    if approved_amount is not None:
        optional_rows += _html_row("Approved Amount", f"₹ {approved_amount:,.2f}")
    if patient_name:
        optional_rows += _html_row("Patient Name", patient_name)
    if hospital_name:
        optional_rows += _html_row("Hospital", hospital_name)
    if diagnosis:
        optional_rows += _html_row("Diagnosis", diagnosis)

    html = f"""\
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:30px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">

  <!-- Banner -->
  <tr>
    <td style="background:{banner_color};color:{banner_text_color};padding:24px 30px;font-size:22px;font-weight:700;letter-spacing:0.5px;">
      {event_icon} {event_label}
    </td>
  </tr>

  <!-- Greeting -->
  <tr>
    <td style="padding:24px 30px 8px;font-size:16px;color:#333;">
      Dear <strong>{employee_name}</strong>,
    </td>
  </tr>
  <tr>
    <td style="padding:0 30px 20px;font-size:15px;color:#555;line-height:1.6;">
      {"A query has been raised on your medical reimbursement claim. Please review the details below and respond at the earliest."
       if event_type == "QUERY" else
       "We regret to inform you that your medical reimbursement claim has been <strong style='color:#dc3545;'>rejected</strong>. Please review the details below."}
    </td>
  </tr>

  <!-- Claim Details Table -->
  <tr>
    <td style="padding:0 30px 20px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;">
        <tr style="background:#f8f9fa;">
          <td colspan="2" style="padding:12px 16px;font-size:14px;font-weight:700;color:#333;border-bottom:1px solid #e0e0e0;">
            📋 Claim Details
          </td>
        </tr>
        {_html_row("Claim ID", claim_short)}
        {_html_row("Stage", stage_name)}
        {_html_row("Status", claim_status)}
        {_html_row("Bill Amount", f"₹ {bill_amount:,.2f}")}
        {optional_rows}
      </table>
    </td>
  </tr>

  <!-- Message Box -->
  <tr>
    <td style="padding:0 30px 24px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff8e1;border-left:4px solid {banner_color};border-radius:4px;">
        <tr>
          <td style="padding:16px;font-size:14px;color:#333;">
            <strong>{"📝 Query Message" if event_type == "QUERY" else "📝 Rejection Reason"}:</strong><br/>
            <span style="display:inline-block;margin-top:8px;line-height:1.6;">{message}</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- CTA -->
  <tr>
    <td align="center" style="padding:0 30px 30px;">
      <a href="#" style="display:inline-block;padding:12px 32px;background:#1a73e8;color:#ffffff;text-decoration:none;border-radius:6px;font-size:15px;font-weight:600;">
        Open ClaimEase Portal
      </a>
    </td>
  </tr>

  <!-- Footer -->
  <tr>
    <td style="background:#f8f9fa;padding:16px 30px;font-size:12px;color:#888;text-align:center;border-top:1px solid #e0e0e0;">
      This is an automated notification from <strong>ClaimEase — Medical Reimbursement System</strong>.<br/>
      Please do not reply to this email.
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>"""

    return text, html


def _html_row(label: str, value: str) -> str:
    """Generate a single row of the claim-details table."""
    return (
        f'<tr style="border-bottom:1px solid #f0f0f0;">'
        f'<td style="padding:10px 16px;font-size:13px;color:#666;width:40%;">{label}</td>'
        f'<td style="padding:10px 16px;font-size:13px;color:#333;font-weight:600;">{value}</td>'
        f'</tr>'
    )


def log_query_and_notify_employee(
    db: Session,
    *,
    claim_id: UUID,
    raised_by_user_id: UUID,
    raised_stage: int,
    message: str,
    event_type: str,
) -> Query:
    """
    1. Create a Query record in the database.
    2. Create an in-app Notification for the employee.
    3. Send a detailed HTML email to the employee with full claim info.
    """
    # ── 1. Create Query record ──
    query = Query(
        claim_id=claim_id,
        raised_by=raised_by_user_id,
        raised_stage=raised_stage,
        query_text=message,
        status="PENDING" if event_type == "QUERY" else "RESOLVED",
    )
    db.add(query)
    db.flush()

    # ── 2. Fetch claim with related data for the email ──
    claim = (
        db.query(Claim)
        .options(
            joinedload(Claim.user),
            joinedload(Claim.patient),
            joinedload(Claim.hospital),
        )
        .filter(Claim.claim_id == claim_id)
        .first()
    )
    employee: Optional[User] = claim.user if claim else None

    if not employee:
        return query

    # ── 3. In-app notification ──
    notification_text = (
        f"Claim {str(claim_id)[:8].upper()} {event_type.lower()}: {message}"
    )
    db.add(
        Notification(
            user_id=employee.user_id,
            message=notification_text,
            notification_status="UNREAD",
        )
    )

    # ── 4. Build and send email ──
    patient = claim.patient
    hospital = claim.hospital

    text_body, html_body = _build_email_content(
        employee_name=employee.fullName,
        claim_id=claim_id,
        event_type=event_type,
        stage_number=raised_stage,
        message=message,
        bill_amount=float(claim.totalBillAmount or 0),
        approved_amount=float(claim.approvedAmount) if claim.approvedAmount else None,
        patient_name=patient.patientName if patient else None,
        hospital_name=hospital.hospitalName if hospital else None,
        diagnosis=patient.diagnosis if patient else None,
        claim_status=claim.claim_status.value if hasattr(claim.claim_status, "value") else str(claim.claim_status),
    )

    event_label = "Query Raised" if event_type == "QUERY" else "Claim Rejected"
    subject = f"ClaimEase — {event_label} | Claim #{str(claim_id)[:8].upper()}"

    try:
        _send_email(
            subject=subject,
            recipient=employee.emailAddress,
            body_text=text_body,
            body_html=html_body,
        )
    except Exception as e:
        # Keep core workflow successful even if email fails
        print(f"[WARN] Email notification failed for claim {claim_id}: {e}")

    return query
