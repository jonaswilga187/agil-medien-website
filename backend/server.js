// AGIL Medien und Eventtechnik — Kontaktformular-Backend
// Self-hosted, keine Drittanbieter-Formular-Services. Läuft als eigener
// Node-Service (Port 3000) neben dem statischen Frontend, wie deine
// anderen Projekte auf web01 (Frontend + Node-Backend).

require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

const CAPTCHA_SECRET = process.env.CAPTCHA_SECRET;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://agil-medien.de';
const CONTACT_TO = process.env.CONTACT_TO || 'kontakt@agil-medien.de';
const MIN_FILL_TIME_MS = 3000; // Formulare, die schneller abgeschickt werden, gelten als verdächtig

if (!CAPTCHA_SECRET) {
  console.error('CAPTCHA_SECRET fehlt in der Umgebung — bitte in .env setzen.');
  process.exit(1);
}

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: ALLOWED_ORIGIN }));
app.use(express.json({ limit: '20kb' }));

// -------- Rate limiting --------
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Zu viele Anfragen. Bitte in ein paar Minuten erneut versuchen.' }
});
const captchaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false
});

// -------- Mail transport --------
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// -------- Helpers --------
function sign(a, b) {
  return crypto.createHmac('sha256', CAPTCHA_SECRET).update(`${a}:${b}`).digest('hex');
}

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function stripHeaderInjection(str) {
  return String(str || '').replace(/[\r\n]+/g, ' ').trim();
}

// -------- Routes --------

// Stateless Captcha: zwei kleine Zahlen + HMAC-Token, keine Server-Session nötig.
app.get('/api/captcha', captchaLimiter, (req, res) => {
  const a = Math.floor(Math.random() * 8) + 1;
  const b = Math.floor(Math.random() * 8) + 1;
  const token = sign(a, b);
  res.json({ a, b, token });
});

app.post('/api/contact', contactLimiter, async (req, res) => {
  try {
    const {
      name, email, message, website,
      captcha_answer, captcha_a, captcha_b, captcha_token,
      loaded_at
    } = req.body || {};

    // Honeypot: unsichtbares Feld, das nur Bots ausfüllen
    if (website) {
      return res.status(400).json({ error: 'Ungültige Anfrage.' });
    }

    // Zeitprüfung: zu schnelles Absenden deutet auf ein Skript hin
    const elapsed = Date.now() - Number(loaded_at || 0);
    if (!loaded_at || Number.isNaN(elapsed) || elapsed < MIN_FILL_TIME_MS) {
      return res.status(400).json({ error: 'Bitte das Formular in Ruhe ausfüllen und erneut senden.' });
    }

    // Captcha-Token prüfen (stellt sicher, dass a/b nicht manipuliert wurden)
    if (!captcha_a || !captcha_b || !captcha_token || !timingSafeEqual(sign(captcha_a, captcha_b), captcha_token)) {
      return res.status(400).json({ error: 'Sicherheitsfrage konnte nicht geprüft werden, bitte Seite neu laden.' });
    }
    const expectedSum = Number(captcha_a) + Number(captcha_b);
    if (Number(captcha_answer) !== expectedSum) {
      return res.status(400).json({ error: 'Antwort auf die Sicherheitsfrage ist nicht korrekt.' });
    }

    // Eingaben validieren
    const cleanName = stripHeaderInjection(name);
    const cleanEmail = stripHeaderInjection(email);
    const cleanMessage = String(message || '').trim();

    if (cleanName.length < 2 || cleanName.length > 100) {
      return res.status(400).json({ error: 'Name ist ungültig.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) || cleanEmail.length > 200) {
      return res.status(400).json({ error: 'E-Mail-Adresse ist ungültig.' });
    }
    if (cleanMessage.length < 10 || cleanMessage.length > 5000) {
      return res.status(400).json({ error: 'Nachricht ist zu kurz oder zu lang.' });
    }

    await transporter.sendMail({
      from: process.env.SMTP_FROM || `"Website AGIL Medien" <${process.env.SMTP_USER}>`,
      to: CONTACT_TO,
      replyTo: cleanEmail,
      subject: `Neue Anfrage über die Website von ${cleanName}`,
      text: `Name: ${cleanName}\nE-Mail: ${cleanEmail}\n\nNachricht:\n${cleanMessage}`
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('Fehler beim Versand:', err.message);
    res.status(500).json({ error: 'Interner Fehler beim Versand. Bitte später erneut versuchen.' });
  }
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Contact backend läuft auf Port ${PORT}`);
});
