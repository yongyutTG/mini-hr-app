/**
 * ============================================================
 * Supabase Store — primary data backend compatibility layer
 * ============================================================
 *
 * Uses structured Supabase tables whose names match Google Sheet tabs so the existing Apps Script
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
function supabaseUpsertDirect_(tableName, payload, conflictColumns) {
  var path = supabaseTablePath_(tableName, conflictColumns ? 'on_conflict=' + encodeURIComponent(conflictColumns) : '');
  try {
    supabaseRest_('post', path, payload, {
      Prefer: 'resolution=merge-duplicates,return=representation'
    });
    return { ok: true };
  } catch (err) {
    logError('Supabase direct upsert failed', {
      tableName: tableName,
      error: err && err.message ? err.message : String(err),
      payload: payload
    });
    return { ok: false, error: err && err.message ? err.message : String(err) };
  }
}

function supabaseFilterValue_(value) {
  return encodeURIComponent(String(value));
}


function supabaseGetSheetRows_(sheetName) {
  var mapping = getStructuredTableMapping_(sheetName);
  if (!mapping) throw new Error('supabase_table_mapping_not_found: ' + sheetName);

  var query = 'select=*&limit=10000';
  var rows = supabaseRest_('get', supabaseTablePath_(mapping.table, query), null, null) || [];
  return rows.map(function(row, index) {
    var obj = Object.assign({}, row);
    obj._row = index + 2;
    return obj;
  });
}

function supabaseGetSheetRowByNumber_(sheetName, rowNum) {
  var rows = supabaseGetSheetRows_(sheetName);
  var index = Number(rowNum) - 2;
  if (index < 0 || index >= rows.length) return null;
  return rows[index];
}

function supabaseBuildSheetPayload_(sheetName, obj) {
  var payload = {};
  Object.keys(obj || {}).forEach(function(key) {
    if (key === '_row') return;
    var columnName = structuredColumnName_(key);
    payload[columnName] = normalizeStructuredValue_(columnName, obj[key]);
  });
  payload.updated_at = new Date().toISOString();
  return payload;
}

function supabasePrimaryFilter_(mapping, row) {
  if (!mapping || !mapping.conflict) return null;
  var columns = mapping.conflict.split(',');
  var filters = [];
  for (var i = 0; i < columns.length; i++) {
    var column = columns[i].trim();
    if (!column) continue;
    var value = row[column];
    if (value === undefined || value === null || value === '') return null;
    filters.push(column + '=eq.' + supabaseFilterValue_(value));
  }
  return filters.length ? filters.join('&') : null;
}

function supabaseWriteSheetRow_(sheetName, obj) {
  var mapping = getStructuredTableMapping_(sheetName);
  if (!mapping) throw new Error('supabase_table_mapping_not_found: ' + sheetName);
  var payload = supabaseBuildSheetPayload_(sheetName, obj);
  var path = supabaseTablePath_(mapping.table, mapping.conflict ? 'on_conflict=' + encodeURIComponent(mapping.conflict) : '');
  var rows = supabaseRest_('post', path, payload, {
    Prefer: 'resolution=merge-duplicates,return=representation'
  });
  return rows && rows.length ? Object.assign({}, rows[0], { _row: null }) : obj;
}

function supabasePatchSheetRowByNumber_(sheetName, rowNum, updates) {
  var mapping = getStructuredTableMapping_(sheetName);
  if (!mapping) throw new Error('supabase_table_mapping_not_found: ' + sheetName);
  var current = supabaseGetSheetRowByNumber_(sheetName, rowNum);
  if (!current) return false;
  var filter = supabasePrimaryFilter_(mapping, current);
  if (!filter) throw new Error('supabase_primary_key_not_found: ' + sheetName + ' row ' + rowNum);
  var payload = supabaseBuildSheetPayload_(sheetName, updates || {});
  supabaseRest_('patch', supabaseTablePath_(mapping.table, filter), payload, {
    Prefer: 'return=minimal'
  });
  return true;
}

function supabaseDeleteSheetRowByNumber_(sheetName, rowNum) {
  var mapping = getStructuredTableMapping_(sheetName);
  if (!mapping) throw new Error('supabase_table_mapping_not_found: ' + sheetName);
  var current = supabaseGetSheetRowByNumber_(sheetName, rowNum);
  if (!current) return false;
  var filter = supabasePrimaryFilter_(mapping, current);
  if (!filter) throw new Error('supabase_primary_key_not_found: ' + sheetName + ' row ' + rowNum);
  supabaseRest_('delete', supabaseTablePath_(mapping.table, filter), null, {
    Prefer: 'return=minimal'
  });
  return true;
}
function supabaseGetAppRows_(sheetName) {
  return supabaseGetSheetRows_(sheetName);
}

function supabaseInsertAppRow_(sheetName, obj) {
  return supabaseWriteSheetRow_(sheetName, obj);
}

function supabaseUpdateAppRowByNumber_(sheetName, rowNum, updates) {
  return supabasePatchSheetRowByNumber_(sheetName, rowNum, updates);
}

function supabaseDeleteAppRowByNumber_(sheetName, rowNum) {
  return supabaseDeleteSheetRowByNumber_(sheetName, rowNum);
}



