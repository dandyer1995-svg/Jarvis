// Google integration — Gmail and Calendar for the Saltwood & Co account,
// read-only. Since the user's Outlook diary is managed by a third party
// and isn't directly accessible, this Google Calendar also doubles as the
// place Yesss Electrical diary entries get mirrored in manually — so
// events here aren't necessarily all Saltwood-specific.
//
// Requires three environment variables from a Google Cloud OAuth client:
//   GOOGLE_CLIENT_ID
//   GOOGLE_CLIENT_SECRET
//   GOOGLE_REDIRECT_URI   (must exactly match the redirect URI registered
//                          in Google Cloud Console, e.g.
//                          https://<your-app>.onrender.com/auth/google/callback)
//
// Uses the standard OAuth2 authorization code flow with offline access, so
// a refresh token is issued and stored in Postgres via db.js, refreshed
// automatically when it's close to expiring.

const db = require('./db.js');

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar.readonly',
].join(' ');
const PROVIDER = 'google-saltwood';

function isConfigured() {
  return !!(CLIENT_ID && CLIENT_SECRET && REDIRECT_URI);
}

async function isConnected() {
  const row = await db.getOAuthToken(PROVIDER);
  return !!row;
}

function getAuthUrl() {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent', // forces a refresh token every time, even on reconnect
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

async function exchangeCodeForToken(code) {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    code,
    redirect_uri: REDIRECT_URI,
    grant_type: 'authorization_code',
  });
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.error || 'token exchange failed');
  if (!data.refresh_token) {
    throw new Error(
      "Google didn't return a refresh token. This usually happens on a second connect attempt — " +
      'revoke JARVIS at https://myaccount.google.com/permissions and try connecting again.'
    );
  }
  const expiresAt = new Date(Date.now() + data.expires_in * 1000);
  await db.saveOAuthToken(PROVIDER, data.access_token, data.refresh_token, expiresAt);
  return data;
}

async function refreshAccessToken(refreshToken) {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.error || 'token refresh failed');
  const expiresAt = new Date(Date.now() + data.expires_in * 1000);
  // Google doesn't reissue the refresh token on a plain refresh — keep the original.
  await db.saveOAuthToken(PROVIDER, data.access_token, refreshToken, expiresAt);
  return data.access_token;
}

async function getValidAccessToken() {
  const row = await db.getOAuthToken(PROVIDER);
  if (!row) return null;
  const expiresAt = new Date(row.expires_at).getTime();
  if (expiresAt - Date.now() > 120000) return row.access_token;
  return refreshAccessToken(row.refresh_token);
}

async function googleFetch(url) {
  const token = await getValidAccessToken();
  if (!token) throw new Error('Saltwood Gmail is not connected yet');
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  if (!res.ok) throw new Error((data.error && data.error.message) || 'Google API request failed');
  return data;
}

async function getCalendarEvents(daysAhead) {
  const days = daysAhead && daysAhead > 0 ? daysAhead : 1;
  const params = new URLSearchParams({
    timeMin: new Date().toISOString(),
    timeMax: new Date(Date.now() + days * 86400000).toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '25',
  });
  const data = await googleFetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`);
  return (data.items || []).map((e) => ({
    subject: e.summary || '(no title)',
    start: (e.start && (e.start.dateTime || e.start.date)) || null,
    end: (e.end && (e.end.dateTime || e.end.date)) || null,
    location: e.location || null,
    organizer: (e.organizer && (e.organizer.displayName || e.organizer.email)) || null,
    isAllDay: !!(e.start && e.start.date && !e.start.dateTime),
  }));
}

function decodeHeader(headers, name) {
  const h = (headers || []).find((x) => x.name.toLowerCase() === name.toLowerCase());
  return h ? h.value : null;
}

async function getRecentEmails(count, unreadOnly) {
  const top = count && count > 0 ? count : 10;
  const listParams = new URLSearchParams({ maxResults: String(top), labelIds: 'INBOX' });
  if (unreadOnly) listParams.set('q', 'is:unread');
  const list = await googleFetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?${listParams.toString()}`);
  const ids = (list.messages || []).map((m) => m.id);

  const emails = [];
  for (const id of ids) {
    const detailParams = new URLSearchParams({ format: 'metadata' });
    detailParams.append('metadataHeaders', 'Subject');
    detailParams.append('metadataHeaders', 'From');
    const msg = await googleFetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?${detailParams.toString()}`);
    const headers = msg.payload && msg.payload.headers;
    emails.push({
      subject: decodeHeader(headers, 'Subject') || '(no subject)',
      from: decodeHeader(headers, 'From') || 'Unknown',
      received: msg.internalDate ? new Date(Number(msg.internalDate)).toISOString() : null,
      preview: msg.snippet || '',
      isRead: !(msg.labelIds || []).includes('UNREAD'),
    });
  }
  return emails;
}

module.exports = {
  isConfigured,
  isConnected,
  getAuthUrl,
  exchangeCodeForToken,
  getCalendarEvents,
  getRecentEmails,
};
