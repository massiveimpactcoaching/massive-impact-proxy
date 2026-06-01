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

/* ── Email notification via Resend ── */
app.post('/notify', async (req, res) => {
  try {
    const { name, business, email, phone, package: pkg, total, callTime } = req.body;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #0D1B2A;">
        <div style="background: #0D1B2A; padding: 28px 32px; border-radius: 12px 12px 0 0;">
          <h1 style="color: #3B9EFF; font-size: 22px; margin: 0;">New Lead — Massive Impact</h1>
          <p style="color: rgba(255,255,255,0.6); margin: 6px 0 0; font-size: 14px;">Phase 2 conversation completed</p>
        </div>
        <div style="background: #f7faff; padding: 32px; border: 1px solid #dde4ee; border-top: none; border-radius: 0 0 12px 12px;">

          <h2 style="font-size: 16px; color: #0D1B2A; margin: 0 0 16px;">Contact Info</h2>
          <table style="width:100%; border-collapse:collapse; margin-bottom:24px;">
            <tr><td style="padding:8px 0; border-bottom:1px solid #eee; color:#5A7090; width:140px;">Name</td><td style="padding:8px 0; border-bottom:1px solid #eee; font-weight:600;">${name || '—'}</td></tr>
            <tr><td style="padding:8px 0; border-bottom:1px solid #eee; color:#5A7090;">Business</td><td style="padding:8px 0; border-bottom:1px solid #eee; font-weight:600;">${business || '—'}</td></tr>
            <tr><td style="padding:8px 0; border-bottom:1px solid #eee; color:#5A7090;">Email</td><td style="padding:8px 0; border-bottom:1px solid #eee;"><a href="mailto:${email}" style="color:#1A6BCC;">${email || '—'}</a></td></tr>
            <tr><td style="padding:8px 0; color:#5A7090;">Phone</td><td style="padding:8px 0;">${phone || '—'}</td></tr>
          </table>

          <h2 style="font-size: 16px; color: #0D1B2A; margin: 0 0 16px;">Their Package</h2>
          <div style="background:#fff; border:1px solid #dde4ee; border-radius:8px; padding:16px 20px; margin-bottom:24px;">
            <pre style="font-family:inherit; font-size:14px; color:#0D1B2A; white-space:pre-wrap; margin:0;">${pkg || '—'}</pre>
            <div style="margin-top:12px; padding-top:12px; border-top:1px solid #eee; font-weight:700; font-size:16px; color:#1A6BCC;">${total || ''}</div>
          </div>

          <h2 style="font-size: 16px; color: #0D1B2A; margin: 0 0 16px;">Call Scheduled</h2>
          <div style="background:#fff; border:1px solid #dde4ee; border-radius:8px; padding:16px 20px; margin-bottom:24px;">
            <p style="margin:0; font-weight:600; color:#0D1B2A;">📅 ${callTime || '—'}</p>
          </div>

          <h2 style="font-size: 16px; color: #0D1B2A; margin: 0 0 16px;">Onboarding Questions to Send Them</h2>
          <div style="background:#fff; border-left:3px solid #1A6BCC; padding:16px 20px; border-radius:4px; font-size:14px; color:#5A7090; line-height:1.8;">
            Before your call, send <strong>${name || 'them'}</strong> a quick email asking:<br/><br/>
            1. What's your business name and primary service area?<br/>
            2. What services do you offer and what are your current prices?<br/>
            3. Do you have an existing website? If so, what's the URL?<br/>
            4. How are customers currently contacting you (phone, email, form)?<br/>
            5. What's your biggest challenge with lead capture right now?<br/>
            6. Do you have a Google Business profile set up?<br/>
            7. What would a successful first month with Massive Impact look like to you?
          </div>

          <div style="margin-top:32px; padding-top:24px; border-top:1px solid #eee; text-align:center; color:#aaa; font-size:12px;">
            Massive Impact Custom Assistants · massiveimpactcoaching.com
          </div>
        </div>
      </div>
    `;

    const result = await resend.emails.send({
      from: 'Max <max@massiveimpactcoaching.com>',
      to: 'chris@massiveimpactcoaching.com',
      subject: `🌿 New Lead: ${name || 'Unknown'} — ${business || 'Unknown Business'} — Call: ${callTime || 'TBD'}`,
      html
    });

    console.log('Notification email sent:', result);
    res.json({ success: true });

  } catch (err) {
    console.error('Email error:', err.message);
    res.status(500).json({ error: 'Email error', details: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Proxy running on port ${PORT}`));
