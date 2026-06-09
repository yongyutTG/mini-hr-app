# Setup Guide

ขั้นตอน setup ระบบ Mini HR App ตั้งแต่ศูนย์

---

## Prerequisites

- Google account (ฟรีก็ได้)
- Node.js 18+ (เฉพาะถ้าจะใช้ clasp + scripts)
- LINE account สำหรับสร้าง Official Account
- เวลา ~3-6 ชั่วโมง สำหรับ setup ครบ

---

## Phase 1: Google Workspace Setup (30 นาที)

### 1.1 สร้าง Google Sheet ใหม่

```
https://sheets.new
```

ตั้งชื่อ "Mini HR App - Data" (หรือชื่ออะไรก็ได้)

จด **Sheet ID** จาก URL:
```
https://docs.google.com/spreadsheets/d/<SHEET_ID>/edit
                                       ^^^^^^^^^^
```

### 1.2 สร้าง Google Drive folder

ไปที่ https://drive.google.com → New → Folder → "Mini HR App - Files"

ภายในให้สร้าง 4 sub-folders:
- `selfies/`
- `id-cards/`
- `daily-photos/`
- `evidence/`

จด **Folder ID** จาก URL:
```
https://drive.google.com/drive/folders/<FOLDER_ID>
                                       ^^^^^^^^^^
```

### 1.3 เปิด Apps Script Editor

จาก Google Sheet ที่เพิ่งสร้าง:
- Menu → Extensions → Apps Script

จะเปิด Apps Script Editor ขึ้นมา

---

## Phase 2: Deploy Backend (1 ชั่วโมง)

### 2.1 Copy โค้ดทั้งหมด

แต่ละไฟล์ใน `src/` ให้ copy ใส่ใน Apps Script Editor:

1. ลบ `Code.gs` เดิม
2. เพิ่มไฟล์ใหม่ทีละไฟล์ผ่าน + ทางซ้าย
3. Apps Script ไม่รองรับ subfolder — ให้ flatten ทุกไฟล์ใน folder เดียว

หรือใช้ clasp:

```bash
# install clasp
npm install -g @google/clasp
clasp login

# clone existing project (after creating Apps Script project from Sheet)
clasp clone <SCRIPT_ID>

# คัดลอกไฟล์จาก src/ ลง root ของ clasp project (flatten)
cp src/*.gs ./
cp src/handlers/*.gs ./
cp src/flex/*.gs ./
cp src/triggers/*.gs ./

# push
clasp push
```

### 2.2 ตั้ง Script Properties

ใน Apps Script Editor:
- Project Settings (เกียร์ ⚙️ ซ้ายล่าง)
- Script Properties → Add script property

เพิ่ม 14 keys:

| Key | Value |
|---|---|
| `LINE_CHANNEL_ACCESS_TOKEN` | (ดูใน Phase 3) |
| `LINE_CHANNEL_SECRET` | (ดูใน Phase 3) |
| `SHEET_ID` | จาก step 1.1 |
| `DRIVE_FOLDER_ID` | จาก step 1.2 |
| `OWNER_LINE_USER_ID` | (ดูใน Phase 4) |
| `LIFF_ID_REGISTER` | (ดูใน Phase 4) |
| `LIFF_ID_CHECKIN` | (ดูใน Phase 4) |
| `LIFF_ID_LEAVE` | ... |
| `LIFF_ID_OT` | ... |
| `LIFF_ID_BALANCE` | ... |
| `LIFF_ID_HR_TOOLS` | ... |
| `LIFF_ID_APPROVAL` | ... |
| `LIFF_ID_EVIDENCE` | ... |
| `LIFF_ID_RESPONSE` | ... |

> ใส่ค่า placeholder ไปก่อนสำหรับ LINE_* และ LIFF_* แล้วกลับมาแก้หลังจาก Phase 3-4

### 2.3 Run setupSheets()

ใน Apps Script Editor:
- เลือก function `setupSheets`
- กด Run
- (จะมี popup ขอ permission — Approve)
- รอ 10-30 วินาที

เช็คใน Sheet — จะมี 11 sheets ถูกสร้าง

### 2.4 Deploy Web App

- Apps Script → Deploy → New deployment
- Type: Web app
- Execute as: **Me**
- Who has access: **Anyone**
- Deploy

Copy URL ที่ได้ — เก็บไว้สำหรับ LINE webhook (Phase 3.3)

---

## Phase 3: LINE Setup (1.5 ชั่วโมง)

### 3.1 สร้าง LINE Official Account

ไป https://www.linebiz.com/th/entry → Free plan OK

### 3.2 Channel ใน LINE Developers Console

ไป https://developers.line.biz/console → สร้าง Provider + Messaging API channel

ใน Channel:
- **Channel Secret** (Basic Settings tab) → copy ใส่ Script Property `LINE_CHANNEL_SECRET`
- **Channel Access Token** (Messaging API tab → Issue) → copy ใส่ `LINE_CHANNEL_ACCESS_TOKEN`
- ปิด **Auto-reply messages** และ **Greeting messages**

### 3.3 ตั้ง Webhook

ใน Messaging API tab:
- Webhook URL: paste URL จาก Phase 2.4
- Use webhook: **ON**
- Verify (ปุ่ม) — ต้องขึ้น Success

### 3.4 หา Owner LINE User ID

วิธีง่ายสุด:
- ส่งข้อความใดๆ ให้ OA จากบัญชี LINE ตัวเอง
- เปิด Sheet "Logs" — จะเห็น userId ของคุณ
- Copy ใส่ Script Property `OWNER_LINE_USER_ID`

---

## Phase 4: LIFF Apps (1 ชั่วโมง)

ใน Channel เดียวกัน → LIFF tab → Add LIFF

สร้าง 9 LIFF apps:

| LIFF Name | Endpoint URL | Size | Scope |
|---|---|---|---|
| liff-register | `<APPS_SCRIPT_URL>?page=register` | Full | profile, openid |
| liff-checkin | `<APPS_SCRIPT_URL>?page=checkin` | Full | profile, openid |
| liff-leave | `<APPS_SCRIPT_URL>?page=leave` | Full | profile, openid |
| liff-ot | `<APPS_SCRIPT_URL>?page=ot` | Full | profile, openid |
| liff-balance | `<APPS_SCRIPT_URL>?page=balance` | Full | profile, openid |
| liff-hr-tools | `<APPS_SCRIPT_URL>?page=hr-tools` | Full | profile, openid |
| liff-approval | `<APPS_SCRIPT_URL>?page=approval-inbox` | Full | profile, openid |
| liff-evidence | `<APPS_SCRIPT_URL>?page=evidence` | Full | profile, openid |
| liff-response | `<APPS_SCRIPT_URL>?page=response` | Tall | profile, openid |

หลังสร้างแต่ละตัว — copy LIFF ID ใส่ Script Properties ที่ตรงกัน

---

## Phase 5: Rich Menu (30 นาที)

ใช้สคริปต์:

```bash
cd scripts/
export LINE_ACCESS_TOKEN=...
export LIFF_ID_REGISTER=...
# ... etc

node create-rich-menu.js
```

หรือสร้างผ่าน LINE OA Manager (https://manager.line.biz) → Rich Menu

อัปโหลดรูป rich menu 2500×843px ที่มี 5 ปุ่ม (สำหรับพนักงาน) / 4 ปุ่ม (สำหรับเจ้าของ)

---

## Phase 6: Setup Triggers (5 นาที)

ใน Apps Script Editor:
- เลือก function `setupTriggers`
- Run
- จะสร้าง time triggers 4 ตัวอัตโนมัติ:
  - `endWorkReminder` daily 17:30
  - `lateCheckinAlert` daily 09:30
  - `pendingApprovalReminder` every 2 hours
  - `cleanupOldLogs` daily 02:00

---

## Phase 7: Test (1 ชั่วโมง)

### 7.1 Add LINE OA เป็นเพื่อน

QR code ใน Channel → scan ด้วยบัญชี LINE ตัวเอง

### 7.2 ลงทะเบียน

กด Rich Menu → ลงทะเบียน → กรอกข้อมูล → ดูใน Sheet `Employees`

### 7.3 ตั้ง approver

เปิด Sheet `Employees` → กรอก `approver_L1_id` เป็น employee_id ของตัวเอง (เพื่อทดสอบ self-approval)

### 7.4 ลงเวลา

กด Rich Menu → เช็คอิน → ดูใน Sheet `Checkins`

### 7.5 ลา/OT/อนุมัติ flow

ทดสอบ flow ส่ง → อนุมัติ → เห็น flex card → กด approve

### 7.6 ปิดงวด

กด Rich Menu → เครื่องมือ HR → tab รายงาน → ปิดงวด

---

## Done!

ถ้าทุก flow ทำงานได้ → ระบบพร้อมใช้

ถ้าเจอปัญหา → ดู [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
