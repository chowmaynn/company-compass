/**
 * Booking Sheet → JSON web app
 *
 * Deploy:
 *   1. Open the sheet → Extensions → Apps Script
 *   2. Paste this file in as Code.gs (replace whatever is there)
 *   3. Set SHEET_NAME below to the tab name (currently assumes the tab with
 *      gid=214645050; rename here if Apps Script tells you "sheet not found")
 *   4. Set TOKEN below to any random string — also put the same value in
 *      .env as VITE_BOOKING_SHEET_TOKEN
 *   5. Deploy → New deployment → Type: Web app
 *        Execute as: Me
 *        Who has access: Anyone (the token is the gate)
 *   6. Copy the /exec URL into .env as VITE_BOOKING_SHEET_URL
 *
 * Test in a browser:
 *   <deployment-url>?token=<TOKEN>
 *
 * The response is { rows: [ {<headerCol>: <value>, ...}, ... ] }.
 * Header row is the first row of the sheet. Values are returned as-is
 * (numbers stay numbers, dates become ISO strings).
 */

const SHEET_NAME = 'Summary';
const TOKEN = 'CHANGE_ME_TO_A_RANDOM_STRING';

function doGet(e) {
  try {
    const token = (e && e.parameter && e.parameter.token) || '';
    if (token !== TOKEN) {
      return json({ error: 'unauthorized' }, 401);
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = SHEET_NAME ? ss.getSheetByName(SHEET_NAME) : ss.getSheets()[0];
    if (!sheet) return json({ error: 'sheet not found: ' + SHEET_NAME }, 404);

    const values = sheet.getDataRange().getValues();
    if (values.length < 2) return json({ rows: [] });

    const headers = values[0].map(h => String(h).trim());
    const rows = values.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, i) => {
        if (!h) return;
        let v = row[i];
        if (v instanceof Date) v = Utilities.formatDate(v, 'Pacific/Auckland', "yyyy-MM-dd");
        obj[h] = v;
      });
      return obj;
    });

    return json({ rows });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
}

function json(payload, _status) {
  // Apps Script web apps can't set status codes on ContentService, but
  // including the field in the body lets the client detect errors.
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
