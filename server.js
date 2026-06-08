const express = require('express');
const cors = require('cors');
const { Resend } = require('resend');

const app = express();
app.use(cors());
app.use(express.json());

const resend = new Resend(process.env.RESEND_API_KEY);

/* ── Anthropic proxy ── */
app.post('/chat', async (req, res) => {
  try {
    console.log('Received request, calling Anthropic...');
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    console.log('Anthropic response status:', response.status);
    res.json(data);
  } catch (err) {
    console.error('Proxy error:', err.message);
    res.status(500).json({ error: 'Proxy error', details: err.message });
  }
});

/* ── Internal notification email to Chris ── */
app.post('/notify', async (req, res) => {
  try {
    const { name, business, email, phone, package: pkg, total, callTime } = req.body;

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#0D1B2A;">
        <div style="background:#0D1B2A;padding:28px 32px;border-radius:12px 12px 0 0;">
          <h1 style="color:#3B9EFF;font-size:22px;margin:0;">New Lead — Massive Impact</h1>
          <p style="color:rgba(255,255,255,0.6);margin:6px 0 0;font-size:14px;">Phase 2 conversation completed</p>
        </div>
        <div style="background:#f7faff;padding:32px;border:1px solid #dde4ee;border-top:none;border-radius:0 0 12px 12px;">
          <h2 style="font-size:16px;color:#0D1B2A;margin:0 0 16px;">Contact Info</h2>
          <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
            <tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#5A7090;width:140px;">Name</td><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600;">${name || '—'}</td></tr>
            <tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#5A7090;">Business</td><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600;">${business || '—'}</td></tr>
            <tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#5A7090;">Email</td><td style="padding:8px 0;border-bottom:1px solid #eee;"><a href="mailto:${email}" style="color:#1A6BCC;">${email || '—'}</a></td></tr>
            <tr><td style="padding:8px 0;color:#5A7090;">Phone</td><td style="padding:8px 0;">${phone || '—'}</td></tr>
          </table>
          <h2 style="font-size:16px;color:#0D1B2A;margin:0 0 16px;">Their Package</h2>
          <div style="background:#fff;border:1px solid #dde4ee;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
            <pre style="font-family:inherit;font-size:14px;color:#0D1B2A;white-space:pre-wrap;margin:0;">${pkg || '—'}</pre>
            <div style="margin-top:12px;padding-top:12px;border-top:1px solid #eee;font-weight:700;font-size:16px;color:#1A6BCC;">${total || ''}</div>
          </div>
          <h2 style="font-size:16px;color:#0D1B2A;margin:0 0 16px;">Call Scheduled</h2>
          <div style="background:#fff;border:1px solid #dde4ee;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
            <p style="margin:0;font-weight:600;color:#0D1B2A;">📅 ${callTime || '—'}</p>
          </div>
          <h2 style="font-size:16px;color:#0D1B2A;margin:0 0 16px;">Onboarding Questions to Send Them</h2>
          <div style="background:#fff;border-left:3px solid #1A6BCC;padding:16px 20px;border-radius:4px;font-size:14px;color:#5A7090;line-height:1.8;">
            Before your call, send <strong>${name || 'them'}</strong> a quick email asking:<br/><br/>
            1. What's your business name and primary service area?<br/>
            2. What services do you offer and what are your current prices?<br/>
            3. Do you have an existing website? If so, what's the URL?<br/>
            4. How are customers currently contacting you (phone, email, form)?<br/>
            5. What's your biggest challenge with lead capture right now?<br/>
            6. Do you have a Google Business profile set up?<br/>
            7. What would a successful first month with Massive Impact look like to you?
          </div>
          <div style="margin-top:32px;padding-top:24px;border-top:1px solid #eee;text-align:center;color:#aaa;font-size:12px;">
            Massive Impact Custom Assistants · massiveimpactcoaching.com
          </div>
        </div>
      </div>`;

    const result = await resend.emails.send({
      from: 'Max at Massive Impact <max@massiveimpactcoaching.com>',
      to: 'chris@massiveimpactcoaching.com',
      subject: `🌿 New Lead: ${name || 'Unknown'} — ${business || 'Unknown'} — Call: ${callTime || 'TBD'}`,
      html
    });

    console.log('Internal notification sent:', result);
    res.json({ success: true });

  } catch (err) {
    console.error('Notify error:', err.message);
    res.status(500).json({ error: 'Notify error', details: err.message });
  }
});

/* ── Quote email to prospect ── */
app.post('/quote', async (req, res) => {
  try {
    const { name, business, email, package: pkg, total, callTime } = req.body;

    // Build itemized rows from package string
    const lines = (pkg || '').split('\n').filter(l => l.trim());
    const rows = lines.map(line => {
      const clean = line.replace(/^[✓•\-\*]\s*/, '').trim();
      return `<tr>
        <td style="padding:12px 16px;border-bottom:1px solid #eee;color:#0D1B2A;font-size:14px;">${clean}</td>
      </tr>`;
    }).join('');

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f0f4f9;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f9;padding:40px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

      <!-- HEADER -->
      <tr>
        <td style="background:#0D1B2A;padding:32px 40px;border-radius:12px 12px 0 0;text-align:center;">
          <h1 style="color:#fff;font-size:28px;margin:0;letter-spacing:-0.5px;">Massive Impact</h1>
          <p style="color:#3B9EFF;font-size:13px;margin:6px 0 0;letter-spacing:0.1em;text-transform:uppercase;">Custom Assistants</p>
        </td>
      </tr>

      <!-- HERO -->
      <tr>
        <td style="background:#1A6BCC;padding:28px 40px;text-align:center;">
          <p style="color:rgba(255,255,255,0.85);font-size:13px;margin:0 0 8px;letter-spacing:0.08em;text-transform:uppercase;">Your Custom Quote</p>
          <h2 style="color:#fff;font-size:24px;margin:0;font-weight:700;">Hey ${name || 'there'}, you're one step away.</h2>
          <p style="color:rgba(255,255,255,0.75);font-size:15px;margin:12px 0 0;line-height:1.6;">Here's the package you built with Max — everything you need to capture leads 24/7 and stop missing customers after hours.</p>
        </td>
      </tr>

      <!-- BODY -->
      <tr>
        <td style="background:#fff;padding:40px;border-left:1px solid #dde4ee;border-right:1px solid #dde4ee;">

          <!-- Business info -->
          <p style="font-size:14px;color:#5A7090;margin:0 0 24px;">Prepared for: <strong style="color:#0D1B2A;">${business || 'Your Business'}</strong></p>

          <!-- Package table -->
          <h3 style="font-size:16px;color:#0D1B2A;margin:0 0 12px;font-weight:700;">Your Selected Package</h3>
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:8px;overflow:hidden;margin-bottom:24px;">
            <tr style="background:#f7faff;">
              <td style="padding:10px 16px;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#5A7090;">Feature</td>
            </tr>
            ${rows || '<tr><td style="padding:12px 16px;color:#5A7090;font-size:14px;">Custom package</td></tr>'}
          </table>

          <!-- Total -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7faff;border:1px solid #dde4ee;border-radius:8px;margin-bottom:32px;">
            <tr>
              <td style="padding:16px 20px;">
                <p style="margin:0;font-size:13px;color:#5A7090;text-transform:uppercase;letter-spacing:0.08em;font-weight:700;">Investment</p>
                <p style="margin:8px 0 0;font-size:22px;font-weight:800;color:#0D1B2A;">${total || 'Custom pricing'}</p>
                <p style="margin:4px 0 0;font-size:13px;color:#5A7090;">Most owners recoup their setup cost in the first month from leads they were previously missing.</p>
              </td>
            </tr>
          </table>

          <!-- Call time -->
          ${callTime ? `
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #dde4ee;border-radius:8px;margin-bottom:32px;">
            <tr>
              <td style="padding:16px 20px;">
                <p style="margin:0;font-size:13px;color:#5A7090;text-transform:uppercase;letter-spacing:0.08em;font-weight:700;">Your Call With Chris</p>
                <p style="margin:8px 0 0;font-size:16px;font-weight:700;color:#0D1B2A;">📅 ${callTime}</p>
                <p style="margin:4px 0 0;font-size:13px;color:#5A7090;">You'll receive a calendar confirmation shortly. Chris will walk you through setup and answer any questions.</p>
              </td>
            </tr>
          </table>` : ''}

          <!-- CTA -->
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" style="padding:8px 0 32px;">
                <a href="https://calendly.com/chris-massiveimpactcoaching/free-20-minute-demo-call"
                   style="display:inline-block;background:#1A6BCC;color:#fff;font-size:16px;font-weight:700;padding:16px 40px;border-radius:10px;text-decoration:none;letter-spacing:0.02em;">
                  Let's Get Started →
                </a>
                <p style="margin:12px 0 0;font-size:13px;color:#aaa;">Or reply to this email with any questions</p>
              </td>
            </tr>
          </table>

          <!-- What happens next -->
          <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #eee;padding-top:28px;margin-top:8px;">
            <tr>
              <td>
                <h3 style="font-size:15px;color:#0D1B2A;margin:0 0 16px;">What Happens Next</h3>
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="width:32px;vertical-align:top;padding-top:2px;">
                      <div style="width:24px;height:24px;background:#1A6BCC;border-radius:50%;text-align:center;color:#fff;font-size:12px;font-weight:700;line-height:24px;">1</div>
                    </td>
                    <td style="padding:0 0 14px 12px;font-size:14px;color:#5A7090;line-height:1.5;"><strong style="color:#0D1B2A;">Chris reviews your quote</strong> and prepares your custom bot setup based on your business details.</td>
                  </tr>
                  <tr>
                    <td style="width:32px;vertical-align:top;padding-top:2px;">
                      <div style="width:24px;height:24px;background:#1A6BCC;border-radius:50%;text-align:center;color:#fff;font-size:12px;font-weight:700;line-height:24px;">2</div>
                    </td>
                    <td style="padding:0 0 14px 12px;font-size:14px;color:#5A7090;line-height:1.5;"><strong style="color:#0D1B2A;">Your 20-minute onboarding call</strong> — we'll walk through your services, pricing, and brand so Max sounds exactly like your business.</td>
                  </tr>
                  <tr>
                    <td style="width:32px;vertical-align:top;padding-top:2px;">
                      <div style="width:24px;height:24px;background:#1A6BCC;border-radius:50%;text-align:center;color:#fff;font-size:12px;font-weight:700;line-height:24px;">3</div>
                    </td>
                    <td style="padding:0 0 0 12px;font-size:14px;color:#5A7090;line-height:1.5;"><strong style="color:#0D1B2A;">Your bot goes live</strong> — typically within 5–7 business days. We test everything before launch.</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

        </td>
      </tr>

      <!-- FOOTER -->
      <tr>
        <td style="background:#0D1B2A;padding:28px 40px;border-radius:0 0 12px 12px;text-align:center;">
          <p style="color:#fff;font-size:15px;font-weight:700;margin:0 0 4px;">Max — Massive Impact Custom Assistants</p>
          <p style="color:rgba(255,255,255,0.4);font-size:13px;margin:0 0 16px;">massiveimpactcoaching.com</p>
          <p style="color:rgba(255,255,255,0.25);font-size:11px;margin:0;">You received this because you requested a quote at massiveimpactcoaching.com</p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;

    const result = await resend.emails.send({
      from: 'Max at Massive Impact <max@massiveimpactcoaching.com>',
      to: email,
      replyTo: 'chris@massiveimpactcoaching.com',
      subject: `Your Massive Impact Quote — ${total || 'Custom Package'}`,
      html
    });

    console.log('Quote email sent to:', email, result);
    res.json({ success: true });

  } catch (err) {
    console.error('Quote error:', err.message);
    res.status(500).json({ error: 'Quote error', details: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Proxy running on port ${PORT}`));
