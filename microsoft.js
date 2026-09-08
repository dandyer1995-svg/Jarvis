// Microsoft Graph integration — Outlook calendar and mail, read-only.
//
// Requires three environment variables, all obtained from an Azure app
// registration (see the setup notes in the conversation this was built in):
//   MICROSOFT_CLIENT_ID
//   MICROSOFT_CLIENT_SECRET
//   MICROSOFT_REDIRECT_URI   (must exactly match the redirect URI registered
//                             in Azure, e.g. https://<your-app>.onrender.com/auth/microsoft/callback)
//
// Uses the OAuth2 authorization code flow against the 'common' tenant
// endpoint, so it works for both personal and work/school Microsoft
// accounts. Tokens are stored in Postgres via db.js and refreshed
// automatically when they're close to expiring — no re-login needed once
// connected, until the refresh token itself is revoked.

const db = require('./db.js');

const CLIENT_ID = process.env.MICROSOFT_CLIENT_ID;
const CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET;
const REDIRECT_URI = process.env.MICROSOFT_REDIRECT_URI;
const AUTHORITY = 'https://login.microsoftonline.com/common/oauth2/v2.0';
const SCOPES = 'offline_access Calendars.Read Mail.Read User.Read';
const PROVIDER = 'microsoft';

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
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    response_mode: 'query',
    scope: SCOPES,
    prompt: 'consent',
  });
  return `${AUTHORITY}/authorize?${params.toString()}`;
}

async function exchangeCodeForToken(code) {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    code,
    redirect_uri: REDIRECT_URI,
    grant_type: 'authorization_code',
    scope: SCOPES,
  });
  const res = await fetch(`${AUTHORITY}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || 'token exchange failed');
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
    scope: SCOPES,
  });
  const res = await fetch(`${AUTHORITY}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || 'token refresh failed');
  const expiresAt = new Date(Date.now() + data.expires_in * 1000);
  // Microsoft doesn't always rotate the refresh token — keep the old one if a new one isn't issued.
  await db.saveOAuthToken(PROVIDER, data.access_token, data.refresh_token || refreshToken, expiresAt);
  return data.access_token;
}

async function getValidAccessToken() {
  const row = await db.getOAuthToken(PROVIDER);
  if (!row) return null;
  const expiresAt = new Date(row.expires_at).getTime();
  if (expiresAt - Date.now() > 120000) return row.access_token; // still valid, 2 min buffer
  return refreshAccessToken(row.refresh_token);
}

async function graphFetch(path) {
  const token = await getValidAccessToken();
  if (!token) throw new Error('Outlook is not connected yet');
  const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Prefer: 'outlook.timezone="Europe/London"',
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error((data.error && data.error.message) || 'Graph API request failed');
  return data;
}

async function getCalendarEvents(daysAhead) {
  const days = daysAhead && daysAhead > 0 ? daysAhead : 1;
  const start = new Date();
  const end = new Date(Date.now() + days * 86400000);
  const params = new URLSearchParams({
    startDateTime: start.toISOString(),
    endDateTime: end.toISOString(),
    $orderby: 'start/dateTime',
    $top: '25',
    $select: 'subject,start,end,location,organizer,isAllDay',
  });
  const data = await graphFetch(`/me/calendarview?${params.toString()}`);
  return (data.value || []).map((e) => ({
    subject: e.subject,
    start: e.start && e.start.dateTime,
    end: e.end && e.end.dateTime,
    location: (e.location && e.location.displayName) || null,
    organizer: (e.organizer && e.organizer.emailAddress && e.organizer.emailAddress.name) || null,
    isAllDay: !!e.isAllDay,
  }));
}

async function getRecentEmails(count, unreadOnly) {
  const top = count && count > 0 ? count : 10;
  const params = new URLSearchParams({
    $top: String(top),
    $orderby: 'receivedDateTime desc',
    $select: 'subject,from,receivedDateTime,bodyPreview,isRead',
  });
  if (unreadOnly) params.set('$filter', 'isRead eq false');
  const data = await graphFetch(`/me/mailFolders/inbox/messages?${params.toString()}`);
  return (data.value || []).map((m) => ({
    subject: m.subject,
    from: (m.from && m.from.emailAddress && (m.from.emailAddress.name || m.from.emailAddress.address)) || 'Unknown',
    received: m.receivedDateTime,
    preview: m.bodyPreview,
    isRead: !!m.isRead,
  }));
}

module.exports = {
  isConfigured,
  isConnected,
  getAuthUrl,
  exchangeCodeForToken,
  getCalendarEvents,
  getRecentEmails,
};
