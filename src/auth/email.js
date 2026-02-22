const config = require('../config');

/**
 * Send a verification email via ElasticEmail API.
 * If EMAIL_API_KEY is not configured, returns false (self-hosted mode skips email).
 */
async function sendVerificationEmail(toEmail, activationHash) {
  if (!config.emailApiKey) {
    console.log('[EMAIL] No EMAIL_API_KEY configured — skipping verification email');
    return false;
  }

  const activationLink = `${config.baseUrl}/activate?email=${encodeURIComponent(toEmail)}&hash=${activationHash}`;

  const bodyHtml = `
    <div style="background:#0a0a0a;color:#e0e0e0;padding:40px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      <div style="max-width:500px;margin:0 auto;">
        <h1 style="color:#fff;font-size:1.5rem;margin-bottom:24px;">Welcome to IOProof</h1>
        <p style="margin-bottom:24px;">Click the button below to verify your email and activate your account.</p>
        <a href="${activationLink}" style="display:inline-block;background:#1a73e8;color:#fff;text-decoration:none;padding:12px 32px;border-radius:6px;font-weight:600;">Verify Email</a>
        <p style="margin-top:24px;color:#888;font-size:0.85rem;">If you didn't create an account on IOProof, ignore this email.</p>
      </div>
    </div>
  `;

  const params = new URLSearchParams({
    apikey: config.emailApiKey,
    from: config.emailFrom,
    fromName: 'IOProof',
    to: toEmail,
    subject: 'Verify your IOProof account',
    bodyHtml,
    bodyText: `Welcome to IOProof. Verify your email: ${activationLink}`,
    isTransactional: 'true',
  });

  try {
    const res = await fetch('https://api.elasticemail.com/v2/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const data = await res.json();
    if (data.success) {
      console.log(`[EMAIL] Verification email sent to ${toEmail}`);
      return true;
    }
    console.error('[EMAIL] Send failed:', data.error);
    return false;
  } catch (err) {
    console.error('[EMAIL] Error:', err.message);
    return false;
  }
}

module.exports = { sendVerificationEmail };
