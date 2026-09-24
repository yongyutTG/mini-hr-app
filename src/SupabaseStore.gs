/**
 * ============================================================
 * Supabase Store — primary data backend compatibility layer
 * ============================================================
 *
 * Uses public.app_rows as a generic JSON row store so the existing Apps Script
 * handlers can keep using SheetStore-style CRUD while Google Sheets is removed
 * from the live path.
 */

function isSupabasePrimary_() {
  return String(getPropOptional('DATA_BACKEND', 'sheets')).toLowerCase() === 'supabase';
}

function supabaseRest_(method, path, payload, extraHeaders) {
  var config = getSupabaseConfig_();
  if (!config.url || !config.serviceKey) {
    throw new Error('missing_supabase_config');
  }

  var options = {
    method: method,
    muteHttpExceptions: true,
    headers: Object.assign({
      apikey: config.serviceKey,
      Authorization: 'Bearer ' + config.serviceKey
    }, extraHeaders || {})
  };

  if (payload !== undefined && payload !== null) {
    options.contentType = 'application/json';
    options.payload = JSON.stringify(payload);
  }

  var response = UrlFetchApp.fetch(config.url + path, options);
  var status = response.getResponseCode();
  var body = response.getContentText();
  if (status < 200 || status >= 300) {
    throw new Error('supabase_rest_failed: ' + status + ' ' + body);
  }
  return body ? JSON.parse(body) : null;
}

function supabaseTablePath_(tableName, query) {
  return '/rest/v1/' + encodeURIComponent(tableName) + (query ? '?' + query : '');
}

function supabaseFilterValue_(value) {
  return encodeURIComponent(String(value));
}

function supabaseGetAppRows_(sheetName) {
  var query = [
    'sheet_name=eq.' + supabaseFilterValue_(sheetName),
    'select=row_num,data',
    'order=row_num.asc'
  ].join('&');
  var rows = supabaseRest_('get', supabaseTablePath_('app_rows', query));
  return (rows || []).map(function(row) {
    var obj = row.data || {};
    obj._row = row.row_num;
    return obj;
  });
}

function supabaseGetAppRowByNumber_(sheetName, rowNum) {
  var query = [
    'sheet_name=eq.' + supabaseFilterValue_(sheetName),
    'row_num=eq.' + encodeURIComponent(String(rowNum)),
    'select=row_num,data',
    'limit=1'
  ].join('&');
  var rows = supabaseRest_('get', supabaseTablePath_('app_rows', query));
  if (!rows || rows.length === 0) return null;
  var obj = rows[0].data || {};
  obj._row = rows[0].row_num;
  return obj;
}

function supabaseNextRowNumber_(sheetName) {
  var query = [
    'sheet_name=eq.' + supabaseFilterValue_(sheetName),
    'select=row_num',
    'order=row_num.desc',
    'limit=1'
  ].join('&');
  var rows = supabaseRest_('get', supabaseTablePath_('app_rows', query));
  if (!rows || rows.length === 0) return 2;
  return Number(rows[0].row_num || 1) + 1;
}

function supabaseRowKey_(sheetName, obj, rowNum) {
  var idFields = [
    'employee_id', 'checkin_id', 'leave_id', 'ot_id', 'payment_id', 'item_id', 'key', 'date'
  ];
  for (var i = 0; i < idFields.length; i++) {
    if (obj[idFields[i]]) return sheetName + ':' + obj[idFields[i]];
  }
  return sheetName + ':row:' + rowNum;
}

function supabaseInsertAppRow_(sheetName, obj) {
  var rowNum = supabaseNextRowNumber_(sheetName);
  var data = Object.assign({}, obj);
  delete data._row;
  var payload = {
    sheet_name: sheetName,
    row_num: rowNum,
    row_key: supabaseRowKey_(sheetName, data, rowNum),
    data: data,
    updated_at: new Date().toISOString()
  };
  supabaseRest_('post', supabaseTablePath_('app_rows'), payload, {
    Prefer: 'return=minimal'
  });
  return obj;
}

function supabaseUpdateAppRowByNumber_(sheetName, rowNum, updates) {
  var current = supabaseGetAppRowByNumber_(sheetName, rowNum);
  if (!current) return false;
  var data = Object.assign({}, current, updates || {});
  delete data._row;
  supabaseRest_('patch', supabaseTablePath_('app_rows', 'sheet_name=eq.' + supabaseFilterValue_(sheetName) + '&row_num=eq.' + encodeURIComponent(String(rowNum))), {
    data: data,
    updated_at: new Date().toISOString()
  }, {
    Prefer: 'return=minimal'
  });
  return true;
}

function supabaseDeleteAppRowByNumber_(sheetName, rowNum) {
  supabaseRest_('delete', supabaseTablePath_('app_rows', 'sheet_name=eq.' + supabaseFilterValue_(sheetName) + '&row_num=eq.' + encodeURIComponent(String(rowNum))), null, {
    Prefer: 'return=minimal'
  });
  return true;
}
