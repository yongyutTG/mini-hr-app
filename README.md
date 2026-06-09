# Mini HR App — Source Code Scaffolding

> ระบบ HR สำหรับ SME ไทย ผ่าน LINE
> Stack: Google Sheets · Apps Script · LINE Messaging API · LIFF
>
> **⚠️ DISCLAIMER:** code นี้คือ scaffolding/skeleton ที่ generate ตาม project spec — **ยังไม่ทดสอบบน production** มี TODO หลายจุด ใช้เป็นจุดเริ่มต้นสำหรับเรียนรู้และพัฒนาต่อ

---

## 📋 What's inside

```
mini-hr-app/
├── README.md                    ← คุณอยู่ที่นี่
├── PROJECT_SPEC.md              ← spec รายละเอียดเต็ม
├── .clasp.json.example          ← clasp config ตัวอย่าง
├── appsscript.json              ← Apps Script manifest
├── src/                         ← Apps Script backend (15 files)
│   ├── Code.gs                  ← entry point
│   ├── Router.gs                ← route to handlers
│   ├── Config.gs                ← script properties + Config sheet
│   ├── Utils.gs                 ← haversine, IDs, time
│   ├── Logger.gs                ← logInfo/logError → Sheet
│   ├── LineApi.gs               ← push, reply, profile, signature
│   ├── DriveStore.gs            ← upload images
│   ├── SheetStore.gs            ← CRUD helpers
│   ├── handlers/
│   │   ├── Register.gs
│   │   ├── Checkin.gs
│   │   ├── Leave.gs
│   │   ├── OT.gs
│   │   ├── Approval.gs          ← multi-level state machine
│   │   ├── Evidence.gs
│   │   ├── Balance.gs
│   │   ├── HRTools.gs
│   │   └── Payment.gs
│   ├── flex/
│   │   ├── ApprovalCard.gs
│   │   ├── CheckinCard.gs
│   │   └── ReminderCard.gs
│   └── triggers/
│       ├── EndWorkReminder.gs
│       ├── LateCheckinAlert.gs
│       └── PendingReminder.gs
├── liff/                        ← LIFF HTML pages (9 files)
│   ├── register.html
│   ├── checkin.html             ← + watermark canvas
│   ├── leave.html
│   ├── ot.html
│   ├── balance.html
│   ├── hr-tools.html
│   ├── approval-inbox.html
│   ├── evidence.html
│   └── response.html
├── scripts/
│   ├── setup-sheet.js           ← สร้าง 11 sheets อัตโนมัติ
│   ├── create-rich-menu.js      ← สร้าง rich menu ผ่าน LINE API
│   └── test-webhook.js          ← ทดสอบ webhook locally
└── docs/
    ├── SETUP.md                 ← ขั้นตอน setup
    ├── DATA_MODEL.md            ← schema 11 sheets
    └── TROUBLESHOOTING.md       ← ปัญหาที่เจอบ่อย
```

---

## 🚀 Quick start

### 1. Prerequisites

```bash
# Node.js 18+
node -v

# install clasp
npm install -g @google/clasp
clasp login
```

### 2. Setup Google project

```bash
# 1. สร้าง Sheet ใหม่ (ทำเอง — Sheets.new)
# 2. เปิด Sheet → Extensions → Apps Script
# 3. ใน Apps Script Editor → Project Settings → "Show appsscript.json" = ON

# 4. ดึง project ลงเครื่อง
clasp clone <SCRIPT_ID>

# หรือ create ใหม่:
clasp create --type sheets --title "Mini HR App"
```

### 3. Copy code

```bash
# copy src/*.gs และ src/handlers/*.gs ฯลฯ ไปที่ Apps Script project ของคุณ
# clasp จะเก็บ path ของไฟล์ในโฟลเดอร์ src/ และ liff/

clasp push
```

### 4. Setup Script Properties

Apps Script → Project Settings → Script Properties → เพิ่ม 14 keys:

```
LINE_CHANNEL_ACCESS_TOKEN = ...
LINE_CHANNEL_SECRET = ...
SHEET_ID = ...
DRIVE_FOLDER_ID = ...
OWNER_LINE_USER_ID = ...
LIFF_ID_REGISTER = ...
LIFF_ID_CHECKIN = ...
LIFF_ID_LEAVE = ...
LIFF_ID_OT = ...
LIFF_ID_BALANCE = ...
LIFF_ID_HR_TOOLS = ...
LIFF_ID_APPROVAL = ...
LIFF_ID_EVIDENCE = ...
LIFF_ID_RESPONSE = ...
```

### 5. Initialize Sheets

ใน Apps Script Editor → เลือก function `setupSheets` → Run

ระบบจะสร้าง 11 sheets + header columns ให้อัตโนมัติ

### 6. Deploy as Web App

```
Deploy → New deployment
  Type: Web app
  Execute as: Me
  Who has access: Anyone
→ Copy URL
```

ใส่ URL ใน LINE Developers → Messaging API → Webhook URL → Verify

### 7. Setup LIFF

สร้าง 9 LIFF apps ใน LINE Developers (ตาม spec) — ใส่ LIFF endpoint URL ชี้ไปหา Apps Script Web App URL

### 8. ลองเลย

- Add LINE OA เป็นเพื่อน
- กด Rich Menu "ลงทะเบียน"
- ดูใน Sheet ว่ามี row ใหม่

---

## ⚠️ ที่ยังไม่ครบ / TODO

โค้ดนี้เป็น scaffolding — **ไม่ใช่ production-ready** มี TODO ต่อไปนี้ที่คุณต้องเติมเอง:

- [ ] LINE webhook signature verify (มี skeleton แต่ยังไม่ test)
- [ ] LIFF camera + watermark canvas — มี skeleton แต่ยังไม่เทส iPhone จริง
- [ ] Multi-level approval edge cases (approver ลาออก, skip level, etc.)
- [ ] Payroll calc — ยังไม่รองรับ public holiday, ภาษี, ประกันสังคม
- [ ] LIFF rate limit + retry logic
- [ ] Localization (ตอนนี้ภาษาไทยฮาร์ดโค้ด)
- [ ] Test cases (มี skeleton แต่ยังไม่ครบ)
- [x] HR Tools UI ฝั่ง LIFF — จัดการพนักงาน รายการเพิ่ม/หัก โควตา วันหยุด รายงาน และปิดงวด
- [ ] Error handling ครบทุก function
- [ ] Permission check ทุก handler (ป้องกัน user มั่ว action)

---

## 📚 Docs

- [PROJECT_SPEC.md](PROJECT_SPEC.md) — Full project specification
- [docs/SETUP.md](docs/SETUP.md) — Setup step-by-step
- [docs/DATA_MODEL.md](docs/DATA_MODEL.md) — 11 sheets schema
- [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) — Common issues

---

## License

MIT-style — ใช้ได้ฟรี เปลี่ยนได้ ห้ามขายต่อในรูปแบบเดิม

---

## Credits

Generated as starter scaffolding for **Mini HR App** by Moodata Project.

ถ้าทำเองแล้วรู้สึก "ยาก/นาน/ไม่ไหว" — ทักได้ครับ
**คุณปริวรรตน์ อรุโณทยานันท์ (พี่ปุ้ย)** — LINE: w.aruno · 061-797-8899
