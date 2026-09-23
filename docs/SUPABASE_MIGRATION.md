# Supabase Parallel Migration

เอกสารนี้ใช้สำหรับย้าย Mini HR App จาก Google Sheets ไป Supabase แบบค่อยเป็นค่อยไป โดยช่วงแรกยังให้ Google Sheets เป็นฐานข้อมูลหลักเหมือนเดิม

## เป้าหมายช่วงแรก

```text
LIFF Frontend
  -> Apps Script
  -> Google Sheets     ฐานหลักเดิม
  -> Supabase          ฐานสำรองแบบ parallel sync
```

ถ้า Supabase sync ล้ม ระบบหลักยังไม่ควรล้ม เพราะ Google Sheets ยังเป็น source of truth

## 1. สร้าง Supabase Project

1. เข้า Supabase
2. สร้าง project ใหม่
3. เปิด SQL Editor
4. นำไฟล์ `supabase/schema.sql` ไปรัน

ตารางที่สร้าง:

- `employees`
- `leave_requests`
- `ot_requests`
- `attendance_logs`
- `sync_errors`

## 2. ตั้งค่า Apps Script Properties

ใน Apps Script ไปที่:

```text
Project Settings
-> Script Properties
```

เพิ่มค่าเหล่านี้:

```text
SUPABASE_SYNC_ENABLED = false
SUPABASE_URL = https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY = service_role_key_from_supabase
```

เริ่มต้นให้ใช้:

```text
SUPABASE_SYNC_ENABLED = false
```

เมื่อพร้อมทดสอบค่อยเปลี่ยนเป็น:

```text
SUPABASE_SYNC_ENABLED = true
```

## 3. ความปลอดภัย

ห้ามใส่ `SUPABASE_SERVICE_ROLE_KEY` ในไฟล์ frontend เช่น:

- `liff/*.html`
- `api/*.js`
- `.env` ที่ถูก commit ขึ้น GitHub

ให้เก็บไว้ใน Apps Script Properties เท่านั้นในช่วง parallel sync

## 4. วิธีใช้งานในโค้ด Apps Script

หลังจากเขียน Google Sheets สำเร็จแล้ว ให้เรียก sync helper ตามประเภทข้อมูล:

```javascript
syncEmployeeToSupabase_(employee);
syncLeaveRequestToSupabase_(leaveRequest);
syncOtRequestToSupabase_(otRequest);
syncCheckinToSupabase_(checkin);
```

หลักสำคัญ:

- เขียน Google Sheets ก่อน
- Supabase sync ทีหลัง
- ถ้า Supabase ล้ม ให้ log error แต่ไม่ทำให้รายการหลักล้ม

## 5. ขั้นตอน migration ที่แนะนำ

### Phase 1: Schema + Manual Test

- สร้าง Supabase table
- ตั้ง Script Properties
- เปิด `SUPABASE_SYNC_ENABLED=false`
- deploy Apps Script ตามปกติ

### Phase 2: Enable Parallel Sync

- เปิด `SUPABASE_SYNC_ENABLED=true`
- ทดลองลงทะเบียน / ส่งใบลา / ขอ OT / ลงเวลา
- ตรวจว่า Google Sheets และ Supabase มีข้อมูลตรงกัน

### Phase 3: Shadow Read

เพิ่ม API/หน้า debug เพื่อเทียบจำนวนข้อมูล เช่น:

- จำนวนพนักงาน
- จำนวนใบลารายเดือน
- จำนวน OT รายเดือน
- จำนวนรายการลงเวลา

### Phase 4: Read From Supabase

เริ่มให้บางหน้าอ่านจาก Supabase ก่อน เช่น:

- ประวัติการลา
- ประวัติ OT
- หน้าโปรไฟล์

### Phase 5: Supabase Primary

เปลี่ยน flow เป็น:

```text
LIFF Frontend
  -> Vercel API
  -> Supabase
```

Google Sheets เหลือเป็น export/backup

## 6. หมายเหตุเรื่อง Storage

ช่วงแรกยังแนะนำให้ใช้ Google Drive เก็บไฟล์แนบต่อไปก่อน เพื่อลดความเสี่ยง

เมื่อ Supabase Database เสถียรแล้ว ค่อยย้ายไฟล์แนบไป Supabase Storage อีกเฟส

## 7. Batch Sync Hook ที่เพิ่มแล้ว

เพิ่มฟังก์ชันใน `src/SupabaseSync.gs` แล้ว:

```javascript
syncSupabaseFromSheets()
```

ใช้สำหรับอ่านข้อมูลจาก Google Sheets แล้ว upsert เข้า Supabase โดย Google Sheets ยังเป็นฐานหลักเหมือนเดิม

ถ้าต้องการตั้ง trigger อัตโนมัติทุก 15 นาที ให้รัน:

```javascript
createSupabaseSyncTrigger()
```

ถ้าชื่อชีตใน Google Sheet ไม่ตรงกับค่า default ให้ตั้ง Script Properties เพิ่มได้:

```text
SUPABASE_EMPLOYEES_SHEET = ชื่อชีตพนักงาน
SUPABASE_LEAVE_REQUESTS_SHEET = ชื่อชีตใบลา
SUPABASE_OT_REQUESTS_SHEET = ชื่อชีตโอที
SUPABASE_ATTENDANCE_LOGS_SHEET = ชื่อชีตลงเวลา
```

ลำดับทดสอบที่แนะนำ:

1. รัน `supabase/schema.sql` ใน Supabase
2. ตั้ง `SUPABASE_URL` และ `SUPABASE_SERVICE_ROLE_KEY`
3. ตั้ง `SUPABASE_SYNC_ENABLED = true`
4. รัน `syncSupabaseFromSheets()` ด้วยมือก่อน
5. ตรวจตาราง Supabase ว่าข้อมูลเข้าไหม
6. ถ้าถูกต้องแล้วค่อยรัน `createSupabaseSyncTrigger()`
