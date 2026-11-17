/**
 * PHC Bhada - Digital Vaccination Management System
 * Optional Google Apps Script Companion for phbhada@gmail.com
 *
 * Deploy as a Web App executed as "Me (phbhada@gmail.com)" if you also want
 * server-side Google Apps Script access in addition to the React Google Sheets API v4 client.
 */

var SPREADSHEET_TITLE = 'PHC Bhada - Digital Vaccination Management System';
var OWNER_EMAIL = 'phbhada@gmail.com';

var TABS_SCHEMA = {
  users: ['id', 'name', 'email', 'mobile', 'role', 'subcentreId', 'subcentreName', 'isActive', 'createdAt'],
  subcentres: ['id', 'code', 'name', 'phcName', 'isActive', 'createdAt', 'updatedAt'],
  villages: ['id', 'villageCode', 'name', 'subcentreId', 'subcentreName', 'population', 'isActive', 'createdAt', 'updatedAt'],
  staff: ['id', 'name', 'designation', 'subcentreId', 'subcentreName', 'mobile', 'linkedUserEmail', 'isActive', 'createdAt', 'updatedAt'],
  beneficiaries: [
    'id', 'beneficiaryCode', 'childName', 'motherName', 'fatherName', 'dob', 'gender',
    'mobile', 'address', 'subcentreId', 'subcentreName', 'villageId', 'villageName',
    'anganwadi', 'registrationDate', 'status', 'dedupeKey', 'createdBy', 'createdAt', 'updatedAt'
  ],
  vaccinationSessions: [
    'id', 'sessionCode', 'phcName', 'subcentreId', 'subcentreName', 'villageId', 'villageName',
    'sessionDate', 'location', 'sessionType', 'choName', 'anmName', 'otherStaff', 'status',
    'editDeadlineAt', 'reopenedUntil', 'reopenedBy', 'reopenReason', 'createdBy', 'createdAt', 'updatedAt'
  ],
  sessionBeneficiaries: [
    'id', 'sessionId', 'beneficiaryId', 'beneficiaryCode', 'childName', 'dob', 'gender',
    'subcentreId', 'villageId', 'addedBy', 'addedAt'
  ],
  vaccineMaster: [
    'id', 'vaccineName', 'shortCode', 'applicableCategory', 'requiresBatchNumber',
    'displayOrder', 'isActive', 'createdAt', 'updatedAt'
  ],
  vaccineSchedule: [
    'id', 'vaccineId', 'vaccineName', 'doseName', 'doseOrder', 'previousDoseId',
    'minAgeValue', 'minAgeUnit', 'recommendedAgeValue', 'recommendedAgeUnit',
    'maxAgeValue', 'maxAgeUnit', 'minIntervalDays', 'recommendedDueRuleText',
    'isBooster', 'boosterInfo', 'applicableCategory', 'isValidated',
    'validatedBy', 'validatedAt', 'isActive', 'createdAt', 'updatedAt'
  ],
  vaccinationRecords: [
    'id', 'beneficiaryId', 'beneficiaryCode', 'sessionId', 'sessionDate', 'subcentreId',
    'villageId', 'vaccineId', 'vaccineName', 'scheduleId', 'doseName', 'administeredDate',
    'batchNumber', 'staffId', 'staffName', 'remarks', 'createdAt', 'updatedAt'
  ],
  auditLogs: [
    'id', 'userId', 'userName', 'userRole', 'action', 'entityType', 'recordId',
    'previousValue', 'newValue', 'reason', 'createdAt'
  ],
  systemSettings: [
    'id', 'phcName', 'district', 'state', 'timezone', 'allowEditDaysAfterSession', 'updatedBy', 'updatedAt'
  ]
};

function ensurePhcSpreadsheet() {
  var activeEmail = Session.getEffectiveUser().getEmail();
  if (activeEmail && activeEmail.toLowerCase() !== OWNER_EMAIL) {
    throw new Error('This script must be deployed under ' + OWNER_EMAIL);
  }

  var files = DriveApp.getFilesByName(SPREADSHEET_TITLE);
  var ss = files.hasNext()
    ? SpreadsheetApp.open(files.next())
    : SpreadsheetApp.create(SPREADSHEET_TITLE);

  ss.setSpreadsheetTimeZone('Asia/Kolkata');
  try {
    ss.setSpreadsheetLocale('en_GB');
  } catch (e) {
    // Fallback safely if locale cannot be updated
  }

  Object.keys(TABS_SCHEMA).forEach(function (tabName) {
    var sheet = ss.getSheetByName(tabName) || ss.insertSheet(tabName);
    if (sheet.getLastRow() === 0) {
      var headers = TABS_SCHEMA[tabName];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, headers.length)
        .setBackground('#0f766e')
        .setFontColor('#ffffff')
        .setFontWeight('bold');
    }
  });

  var defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1) {
    ss.deleteSheet(defaultSheet);
  }

  return ss;
}

function doGet() {
  var ss = ensurePhcSpreadsheet();
  return ContentService.createTextOutput(
    JSON.stringify({
      ok: true,
      spreadsheetId: ss.getId(),
      spreadsheetUrl: ss.getUrl(),
      owner: OWNER_EMAIL
    })
  ).setMimeType(ContentService.MimeType.JSON);
}
