# Mini HR App — Project Specification

> **ระบบ HR ครบวงจรสำหรับ SME ไทย ผ่าน LINE**
> สำหรับเจ้าของธุรกิจที่อยากให้พนักงาน ลงเวลา · ลา · OT · ดูยอด จบในที่เดียวบน LINE
> โดยไม่ต้องโหลด app เพิ่ม ไม่ต้องเปิดคอมพิวเตอร์
>
> **Stack:** Google Sheets + Apps Script + LINE Messaging API + LIFF + n8n (optional)
> **Estimated dev time:** 80-120 ชม. (1 developer)
> **Estimated calendar time:** 3-6 สัปดาห์ (พาร์ตไทม์)

---

## 📑 สารบัญ

1. [เริ่มต้นที่นี่ — ก่อนตัดสินใจทำเอง](#1-เริ่มต้นที่นี่--ก่อนตัดสินใจทำเอง)
2. [Use Cases & User Flows](#2-use-cases--user-flows)
3. [Architecture Overview](#3-architecture-overview)
4. [Data Model — Google Sheets](#4-data-model--google-sheets)
5. [Apps Script — Backend Structure](#5-apps-script--backend-structure)
6. [LIFF Frontend — UI Pages](#6-liff-frontend--ui-pages)
7. [LINE Setup — OA · LIFF · Rich Menu](#7-line-setup--oa--liff--rich-menu)
8. [TASKS — Implementation Checklist](#8-tasks--implementation-checklist)
9. [Setup Step-by-Step](#9-setup-step-by-step)
10. [Common Pitfalls](#10-common-pitfalls)
11. [Cost & Limits](#11-cost--limits)
12. [Definition of Done](#12-definition-of-done)

---

## 1. เริ่มต้นที่นี่ — ก่อนตัดสินใจทำเอง

### คุณควรทำเอง ถ้า…

- มีความรู้พื้นฐาน JavaScript / Google Apps Script
- มีเวลา 4-8 ชม./สัปดาห์ ต่อเนื่อง 4-6 สัปดาห์
- ใช้ LINE Messaging API / LIFF เป็นมาก่อน หรือยอมเรียนรู้
- เข้าใจ webhook · OAuth · base64 · async/await
- ยอมรับว่ารอบแรกจะมี bug เยอะ ต้องทดสอบหลายรอบ

### คุณไม่ควรทำเอง ถ้า…

- ไม่เคยเขียน Apps Script เลย (เรียน basic ก่อน 1-2 สัปดาห์)
- รีบใช้ภายใน 1-2 สัปดาห์
- ไม่มีเวลาทดสอบ — ระบบ HR ถ้าผิดจะกระทบเงินพนักงาน
- ต้องการระบบที่ scale > 200 คน (Apps Script จะเริ่มเจอ quota)

### Skills Checklist

| Skill | ต้องมี | จะได้เรียน |
|---|---|---|
| Google Sheets formulas | ✅ | — |
| JavaScript (ES6+) | ✅ | — |
| Google Apps Script API | — | ✅ |
| LINE Messaging API | — | ✅ |
| LIFF SDK | — | ✅ |
| Flex Message JSON | — | ✅ |
| Webhook signing | — | ✅ |
| Git basics | ✅ | — |

### หลักสำคัญที่ใช้ทั้งโปรเจกต์

1. **Idempotent everything** — ทุกการกระทำซ้ำต้อง safe (เช่น เช็คอินซ้ำวันเดียวกัน = ไม่สร้างแถวใหม่)
2. **Try-catch ทุก function** + log ลง sheet `Logs`
3. **Time zone = Asia/Bangkok** ตลอดทั้งระบบ — ใช้ ISO 8601 + offset `+07:00`
4. **Secrets ใน Script Properties เท่านั้น** — ห้าม hardcode ในไฟล์
5. **Rich Menu ของพนักงาน vs เจ้าของแยกกัน** — ใช้ Rich Menu Alias

---

## 2. Use Cases & User Flows

### Actors

| Role | จำนวน | สิ่งที่ทำได้ |
|---|---|---|
| **พนักงาน** | หลายคน | ลงทะเบียน · ลงเวลา · ขอลา · ขอ OT · ดูยอด · ส่งหลักฐาน |
| **หัวหน้า L1** | หลายคน | อนุมัติคำขอของลูกทีม → ส่งต่อ L2 |
| **ผู้จัดการ L2** | จำนวนน้อย | อนุมัติคำขอที่ผ่าน L1 → ส่งต่อ L3 |
| **HR / เจ้าของ L3** | 1-2 คน | อนุมัติขั้นสุดท้าย · จัดการพนักงาน · ปิดงวด · จ่ายเงิน |

### Core Flows (10 flows)

#### Flow 1: ลงทะเบียนพนักงานใหม่
```
พนักงานกด Rich Menu "ลงทะเบียน"
  → เปิด LIFF /register
  → กรอกข้อมูล (ชื่อ, เบอร์, เลขบัญชี, ธนาคาร)
  → ถ่าย selfie (กล้องสด)
  → ถ่ายบัตรประชาชน
  → submit
  → Apps Script: validate + upload Drive + insert Sheet
  → ส่งข้อความ welcome กลับ LINE
```

#### Flow 2: ลงเวลาเข้างาน (Check-in)
```
พนักงานกด Rich Menu "เช็คอิน"
  → LIFF ขอ GPS permission
  → ถ่าย selfie สด (capture=user, NO gallery)
  → ฝัง watermark (lat,lng + datetime) บน canvas
  → submit
  → Apps Script:
     - หา employee จาก line_user_id
     - คำนวณ haversine vs geofence
     - ถ้านอกรัศมี → reject + flex card เตือนเจ้าของ
     - ถ้าในรัศมี → insert Checkins row (status=pending)
     - ส่ง flex card หาผู้อนุมัติ L1
```

#### Flow 3: ลงเวลาออก + พักเที่ยง (4 ครั้ง/วัน)
```
เหมือน flow 2 แต่ track slot (เข้า/พักเที่ยง/กลับเข้า/ออก)
แต่ละ slot ตรวจสอบเงื่อนไขเวลา (เช่น พักเที่ยงต้อง 11:30-13:30)
```

#### Flow 4: เตือนเลิกงาน + ไล่กลับบ้าน
```
Apps Script Time Trigger ทุกวัน 17:30:
  → ดึงรายชื่อพนักงานที่เช็คอินวันนี้แต่ยัง check-out
  → เช็คว่ามี OT request ที่ approved หรือไม่
  → ถ้าไม่มี OT → push flex card เตือนพนักงาน + เจ้าของ
  → ข้อความ: "ถึงเวลาเลิกงานแล้ว ให้ออกจากออฟฟิศทันที"
  → ถ้าหลัง 18:30 ยังเช็คอินอยู่ → push ครั้งที่ 2
```

#### Flow 5: ส่งใบลา
```
พนักงานกด "ส่งใบลา"
  → เปิด LIFF /leave
  → แสดงสิทธิ์คงเหลือ (ลาป่วย/กิจ/พักร้อน/ไม่รับเงิน)
  → เลือกประเภท + ระยะเวลา (เต็มวัน/ครึ่งวัน/รายชั่วโมง)
  → เลือกวันที่เริ่ม-สิ้นสุด
  → กรอกเหตุผล
  → (optional) แนบหลักฐาน
  → submit
  → ระบบเช็คเงื่อนไข:
     - สิทธิ์เพียงพอไหม
     - ลากิจต้องล่วงหน้ากี่วัน
     - ลาฉุกเฉินอนุญาตหรือไม่
  → insert Leaves row (status=pending_L1)
  → ส่ง flex card หาผู้อนุมัติ L1
```

#### Flow 6: ขอ OT
```
พนักงานกด "ขอ OT"
  → เปิด LIFF /ot
  → เลือกวันที่ + ช่วงเวลา (จาก-ถึง)
  → กรอกเหตุผล
  → submit (ต้องขอล่วงหน้าอย่างน้อย 30 นาทีก่อนเลิกงาน)
  → ส่ง flex card หาผู้อนุมัติ L1
```

#### Flow 7: Multi-level approval
```
L1 ได้รับ flex card → กดอนุมัติ/ปฏิเสธ/ขอข้อมูลเพิ่ม
  → ถ้าอนุมัติ → ส่งต่อ L2 (ถ้าตั้งไว้)
  → ถ้าไม่มี L2 → จบ
L2 ทำซ้ำ → ส่งต่อ L3
L3 อนุมัติ → status=approved + แจ้งพนักงาน
ถ้า any level กด "ขอข้อมูลเพิ่ม"
  → ส่งลิงก์ LIFF /evidence?id=xxx ให้พนักงาน
  → พนักงานแนบไฟล์ → กลับมาที่ flex card รอบใหม่
```

#### Flow 8: ดูยอด/สิทธิ์
```
พนักงานกด "ดูยอด"
  → เปิด LIFF /balance
  → แสดง:
    - เดือนนี้: ทำงาน X วัน · OT Y ชม. · ลา Z วัน
    - ยอดประมาณการ: A บาท (ค่าจ้าง + OT - หัก)
    - สถานะรอบที่แล้ว: รอจ่าย / จ่ายแล้ว
    - สิทธิ์ลาคงเหลือทั้ง 4 ประเภท
```

#### Flow 9: HR Tools (เจ้าของ/HR)
```
เจ้าของกด "เครื่องมือ HR"
  → เปิด LIFF /hr-tools (เฉพาะคนที่อยู่ใน Sheet Approvers ระดับ L3)
  → 5 tabs:
    - พนักงาน: เพิ่ม/แก้/ลบ/active-inactive
    - เงินเพิ่ม/หัก: เบี้ยขยัน · ภงด.1 · อื่นๆ
    - วันหยุดประจำปี
    - โควต้าลา (ปรับแต่ละคน)
    - รายงาน (รายสัปดาห์/รายเดือน)
```

#### Flow 10: ปิดงวด + จ่ายเงิน
```
เจ้าของกด "ปิดงวด" ใน HR Tools
  → ระบบเช็ค pending check-ins/leaves/OT ในเดือนนี้
  → ถ้ามี pending → เตือนก่อน
  → คำนวณยอดของทุกคน:
    base_pay × วันทำงาน + OT_hours × OT_rate + bonus - deductions
  → สร้าง row ใน Payments (status=รอจ่าย)
  → ส่งสรุปยอดทั้งหมดเข้า LINE เจ้าของ
หลังโอนเงินจริง:
  → เจ้าของแก้ status เป็น "จ่ายแล้ว" ใน Sheet หรือผ่านปุ่ม
  → ระบบส่งแจ้งพนักงานว่าโอนแล้ว
```

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                       LINE OA                                    │
│  Rich Menu (พนักงาน)         Rich Menu (เจ้าของ/HR)            │
│  - ลงทะเบียน                  - กล่องอนุมัติ                    │
│  - เช็คอิน                    - เครื่องมือ HR                   │
│  - ส่งใบลา                    - ปิดงวด                          │
│  - ขอ OT                      - ดูรายงาน                        │
│  - ดูยอด                                                         │
└───────────────────────┬─────────────────────────────────────────┘
                        │ (กด rich menu)
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                    LIFF App (Frontend)                          │
│  https://liff.line.me/{liff-id}/{page}                          │
│                                                                  │
│  - register.html    - leave.html      - balance.html            │
│  - checkin.html     - ot.html         - hr-tools.html           │
│  - evidence.html    - response.html                             │
└───────────────────────┬─────────────────────────────────────────┘
                        │ fetch() POST + base64 images
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│            Apps Script Web App (Backend)                        │
│            URL: https://script.google.com/macros/.../exec       │
│                                                                  │
│  doPost(e) → router → action handler:                           │
│  - register · checkin · leave · ot · approve · balance · ...   │
└──────┬──────────────────────────┬───────────────────────────────┘
       │                          │
       ▼                          ▼
┌──────────────────┐    ┌─────────────────────────────────────────┐
│  Google Drive    │    │         Google Sheets                   │
│  - selfies/      │    │  - Employees                            │
│  - id-cards/     │    │  - Approvers (ระดับใครอนุมัติใคร)      │
│  - daily-photos/ │    │  - Checkins                             │
│  - evidence/     │    │  - Leaves                               │
└──────────────────┘    │  - OT                                   │
                        │  - Payments                             │
                        │  - LeaveQuota                           │
                        │  - PayItems (เพิ่ม/หัก)                │
                        │  - Holidays                             │
                        │  - Config                               │
                        │  - Logs                                 │
                        └─────────────────────────────────────────┘
                                       ▲
                                       │ Webhook event
                                       │ (postback, message)
                        ┌──────────────┴──────────────────────────┐
                        │      LINE Messaging API                 │
                        │  - Push Flex Card                        │
                        │  - Reply text                            │
                        │  - User profile lookup                   │
                        └──────────────────────────────────────────┘
```

### Key design decisions

| Decision | เหตุผล |
|---|---|
| ใช้ Google Sheets เป็น DB | ฟรี · เห็นข้อมูลตรงๆ · ไม่ต้อง host · เจ้าของลูกค้าเป็นเจ้าของข้อมูล |
| Apps Script เป็น backend | Run บน Google · ฟรี · มี Sheet API ในตัว · deploy เป็น Web App ได้ |
| LIFF + HtmlService | ไม่ต้อง host เอง · ทำงานใน LINE · เข้าถึง GPS/camera ได้ |
| Multi-level ผ่าน Sheet `Approvers` | configurable per employee · ไม่ต้อง hard-code |
| ไม่ใช้ ML face match | ต้นทุนสูง · accuracy ยังไม่พอ · เจ้าของดูเทียบเองได้ |

---

## 4. Data Model — Google Sheets

มี 11 sheets ใน workbook เดียว:

### Sheet 1: `Employees`

| Column | Type | Note |
|---|---|---|
| employee_id | string | EMP-0001 |
| line_user_id | string | unique |
| display_name | string | |
| phone | string | |
| email | string | optional |
| department | string | |
| position | string | |
| base_pay_monthly | number | บาท/เดือน |
| ot_rate_per_hour | number | บาท/ชม. |
| bank_name | string | |
| bank_account_no | string | |
| bank_account_name | string | |
| selfie_url | string | Drive URL |
| id_card_url | string | Drive URL |
| approver_L1_id | string | employee_id ของหัวหน้า |
| approver_L2_id | string | optional |
| approver_L3_id | string | optional |
| start_date | date | |
| is_active | boolean | |
| registered_at | datetime | |

### Sheet 2: `Approvers`

แทน Sheet `Approvers` แบบมี role table — หรือใช้ field ใน `Employees` ก็ได้ตามที่ออกแบบไว้ข้างบน

### Sheet 3: `Checkins`

| Column | Type | Note |
|---|---|---|
| checkin_id | string | CHK-YYYYMMDD-XXXX |
| employee_id | string | |
| checkin_date | date | |
| slot | enum | IN/LUNCH_OUT/LUNCH_IN/OUT |
| checkin_at | datetime | |
| lat | number | |
| lng | number | |
| distance_m | number | |
| selfie_url | string | watermarked |
| status | enum | pending/approved/rejected/out_of_range |
| approved_by | string | |
| approved_at | datetime | |

### Sheet 4: `Leaves`

| Column | Type | Note |
|---|---|---|
| leave_id | string | LV-YYYYMMDD-XXXX |
| employee_id | string | |
| leave_type | enum | sick/personal/vacation/unpaid/emergency |
| duration_type | enum | full_day/half_day/hourly |
| start_date | date | |
| end_date | date | |
| total_days | number | |
| total_hours | number | nullable |
| reason | text | |
| evidence_url | string | nullable, Drive URL |
| status | enum | pending_L1/pending_L2/pending_L3/approved/rejected/need_info |
| current_approver | string | employee_id |
| approval_history | json | array ของ {level, by, action, at, note} |
| submitted_at | datetime | |

### Sheet 5: `OT`

| Column | Type | Note |
|---|---|---|
| ot_id | string | OT-YYYYMMDD-XXXX |
| employee_id | string | |
| ot_date | date | |
| start_time | time | |
| end_time | time | |
| total_hours | number | |
| reason | text | |
| status | enum | pending_L1/pending_L2/pending_L3/approved/rejected |
| current_approver | string | |
| approval_history | json | |
| submitted_at | datetime | |

### Sheet 6: `Payments`

| Column | Type | Note |
|---|---|---|
| payment_id | string | PAY-YYYYMM-XXXX |
| employee_id | string | |
| period | string | 2026-05 |
| work_days | number | |
| ot_hours | number | |
| base_pay | number | |
| ot_pay | number | |
| bonus | number | from PayItems |
| deduction | number | from PayItems |
| total_amount | number | |
| status | enum | รอจ่าย/จ่ายแล้ว |
| closed_at | datetime | |
| paid_at | datetime | |
| note | text | |

### Sheet 7: `LeaveQuota`

| Column | Type | Note |
|---|---|---|
| employee_id | string | |
| year | number | 2026 |
| sick_quota | number | default 30 |
| sick_used | number | |
| personal_quota | number | default 3 |
| personal_used | number | |
| vacation_quota | number | default 15 |
| vacation_used | number | |

### Sheet 8: `PayItems`

| Column | Type | Note |
|---|---|---|
| item_id | string | |
| employee_id | string | nullable (null = ทุกคน) |
| period | string | 2026-05 |
| type | enum | bonus/deduction |
| amount | number | |
| reason | text | |
| created_by | string | |
| created_at | datetime | |

### Sheet 9: `Holidays`

| Column | Type | Note |
|---|---|---|
| date | date | |
| name | string | "วันแรงงานแห่งชาติ" |
| type | enum | public/company |

### Sheet 10: `Config`

| Key | Example Value |
|---|---|
| company_name | บริษัท XXX จำกัด |
| geofence_lat | 13.7563 |
| geofence_lng | 100.5018 |
| geofence_radius_m | 150 |
| work_start | 09:00 |
| work_end | 18:00 |
| lunch_start | 12:00 |
| lunch_end | 13:00 |
| ot_rate_multiplier | 1.5 |
| sick_quota_default | 30 |
| personal_quota_default | 3 |
| vacation_quota_default | 15 |
| late_threshold_min | 15 |
| ot_request_lead_min | 30 |

### Sheet 11: `Logs`

| Column | Type | Note |
|---|---|---|
| timestamp | datetime | |
| level | enum | info/warn/error |
| function | string | |
| user_id | string | |
| message | string | |
| payload | json | |

---

## 5. Apps Script — Backend Structure

```
partime-checkin-backend (Apps Script Project)
├── Code.gs                  ← entry: doPost, doGet
├── Router.gs                ← route actions to handlers
├── Config.gs                ← getConfig, getProperty
├── Utils.gs                 ← haversine, IDs, nowBangkok
├── Logger.gs                ← logInfo, logError
├── LineApi.gs               ← push, reply, getProfile, verifySignature
├── DriveStore.gs            ← uploadImage, getSignedUrl
├── handlers/
│   ├── Register.gs          ← register()
│   ├── Checkin.gs           ← checkin()
│   ├── Leave.gs             ← submitLeave()
│   ├── OT.gs                ← submitOT()
│   ├── Approval.gs          ← handleApproval() — multi-level state machine
│   ├── Evidence.gs          ← submitEvidence()
│   ├── Balance.gs           ← getBalance()
│   ├── HRTools.gs           ← addEmployee, updatePayItem, ...
│   └── Payment.gs           ← closePeriod, markPaid
├── flex/
│   ├── ApprovalCard.gs      ← buildLeaveApprovalCard, buildOTCard
│   ├── CheckinCard.gs       ← buildCheckinNotifyCard
│   └── ReminderCard.gs      ← buildEndWorkReminder
├── triggers/
│   ├── EndWorkReminder.gs   ← time trigger 17:30 daily
│   ├── LateCheckinAlert.gs  ← time trigger 09:30 daily
│   └── PendingReminder.gs   ← time trigger every 2 hours
└── HtmlService/             ← LIFF pages (if hosted in Apps Script)
    ├── register.html
    ├── checkin.html
    └── ... (8 pages)
```

### Critical functions to implement (พร้อม pseudo-code)

#### `doPost(e)` — entry

```javascript
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    // Verify LINE webhook signature
    if (body.events) {
      const sig = e.parameter['x-line-signature'];
      if (!verifyLineSignature(e.postData.contents, sig)) {
        return jsonError('invalid_signature');
      }
      return handleLineWebhook(body.events);
    }
    // LIFF request
    const action = body.action;
    return route(action, body);
  } catch (err) {
    logError('doPost', err.message, e.postData?.contents);
    return jsonError(err.message);
  }
}
```

#### `register(payload)`

```javascript
function register(payload) {
  const { lineUserId, displayName, phone, bankName, bankAccountNo,
          bankAccountName, selfieBase64, idCardBase64 } = payload;

  // 1. validate
  if (!lineUserId || !displayName || !phone) throw new Error('missing_fields');

  // 2. dedupe
  if (findEmployeeByLineId(lineUserId)) {
    return { ok: false, error: 'already_registered' };
  }

  // 3. upload images
  const selfieUrl = uploadImage(selfieBase64, `selfie_${lineUserId}.jpg`, 'selfies');
  const idCardUrl = uploadImage(idCardBase64, `id_${lineUserId}.jpg`, 'id-cards');

  // 4. insert row
  const employeeId = nextEmployeeId();
  insertEmployee({ employeeId, lineUserId, displayName, phone, bankName,
    bankAccountNo, bankAccountName, selfieUrl, idCardUrl });

  // 5. init leave quota for this year
  initLeaveQuota(employeeId, new Date().getFullYear());

  // 6. welcome message
  pushMessage(lineUserId, [{ type: 'text', text: `ลงทะเบียนเรียบร้อย ${displayName}` }]);

  return { ok: true, employeeId };
}
```

#### `checkin(payload)`

```javascript
function checkin(payload) {
  const { lineUserId, lat, lng, selfieBase64, slot } = payload;
  const config = getConfig();
  const emp = findEmployeeByLineId(lineUserId);
  if (!emp) return { ok: false, error: 'not_registered' };
  if (!emp.is_active) return { ok: false, error: 'inactive' };

  // GPS check
  const distance = haversineMeters(lat, lng, config.geofence_lat, config.geofence_lng);
  if (distance > config.geofence_radius_m) {
    // ส่งเตือนเจ้าของ
    pushFlexToOwner(buildOutOfRangeAlertCard(emp, distance, selfieUrl));
    return { ok: false, error: 'out_of_range', distance };
  }

  // Dedupe per slot per day
  const today = formatDate(new Date());
  const existing = findCheckin(emp.employee_id, today, slot);
  if (existing) return { ok: true, duplicated: true, checkinId: existing.checkin_id };

  // Save
  const selfieUrl = uploadImage(selfieBase64, `chk_${emp.employee_id}_${today}_${slot}.jpg`, 'daily-photos');
  const checkinId = nextCheckinId(today);
  insertCheckin({ checkinId, employee_id: emp.employee_id, slot, lat, lng,
    distance, selfie_url: selfieUrl, status: 'pending' });

  // Notify L1 (if approval required for checkin) — or auto-approve
  // ... depending on company policy

  return { ok: true, checkinId };
}
```

#### `handleApproval(postbackData)` — state machine

```javascript
function handleApproval(data) {
  // data = "action=approve_leave&id=LV-...&level=L1"
  const { action, id, level, type } = parseQuery(data);
  const record = getRecord(type, id); // leaves/ot
  const approverId = findEmployeeByLineId(senderLineId).employee_id;

  // Verify approver matches expected level
  if (record.current_approver !== approverId) {
    return replyText(replyToken, 'คุณไม่ใช่ผู้อนุมัติของคำขอนี้');
  }

  // Append to history
  const history = JSON.parse(record.approval_history || '[]');
  history.push({ level, by: approverId, action, at: nowBangkok() });

  if (action === 'approve') {
    // Find next level
    const employee = getEmployee(record.employee_id);
    const nextLevel = nextApprovalLevel(level);
    const nextApprover = employee[`approver_${nextLevel}_id`];

    if (nextApprover) {
      // Forward to next level
      updateRecord(type, id, {
        status: `pending_${nextLevel}`,
        current_approver: nextApprover,
        approval_history: JSON.stringify(history)
      });
      pushFlex(getLineUserId(nextApprover), buildApprovalCard(record, nextLevel));
    } else {
      // Final approval
      updateRecord(type, id, { status: 'approved', approval_history: JSON.stringify(history) });
      // Update LeaveQuota if leave
      if (type === 'leave') deductLeaveQuota(record);
      // Notify employee
      pushMessage(getLineUserId(record.employee_id), [{
        type: 'text',
        text: `คำขอ${type === 'leave' ? 'ลา' : 'OT'} ${id} ของคุณได้รับการอนุมัติแล้ว`
      }]);
    }
  } else if (action === 'reject') {
    updateRecord(type, id, { status: 'rejected', approval_history: JSON.stringify(history) });
    pushMessage(getLineUserId(record.employee_id), [{
      type: 'text', text: `คำขอ${id} ถูกปฏิเสธ`
    }]);
  } else if (action === 'need_info') {
    updateRecord(type, id, { status: 'need_info', approval_history: JSON.stringify(history) });
    // Send LIFF link to employee
    const liffUrl = `https://liff.line.me/${LIFF_ID_EVIDENCE}?id=${id}&type=${type}`;
    pushMessage(getLineUserId(record.employee_id), [{
      type: 'text', text: `กรุณาส่งหลักฐานเพิ่มเติม: ${liffUrl}`
    }]);
  }

  replyText(replyToken, 'บันทึกแล้ว');
}
```

#### `closePeriod(period)` — payroll calc

```javascript
function closePeriod(period) {
  // period = "2026-05"
  const employees = getActiveEmployees();
  const results = [];

  for (const emp of employees) {
    // 1. count approved work days
    const workDays = countApprovedCheckins(emp.employee_id, period);

    // 2. sum approved OT hours
    const otHours = sumApprovedOT(emp.employee_id, period);

    // 3. calculate base + OT
    const dailyRate = emp.base_pay_monthly / 30;
    const basePay = workDays * dailyRate;
    const otPay = otHours * emp.ot_rate_per_hour * getConfig().ot_rate_multiplier;

    // 4. sum bonuses & deductions from PayItems
    const bonus = sumPayItems(emp.employee_id, period, 'bonus');
    const deduction = sumPayItems(emp.employee_id, period, 'deduction');

    const total = basePay + otPay + bonus - deduction;

    // 5. insert Payment row
    const paymentId = nextPaymentId(period);
    insertPayment({ paymentId, employee_id: emp.employee_id, period,
      work_days: workDays, ot_hours: otHours, base_pay: basePay, ot_pay: otPay,
      bonus, deduction, total_amount: total, status: 'รอจ่าย', closed_at: nowBangkok() });

    results.push({ name: emp.display_name, total });
  }

  // 6. send summary to owner
  const summary = results.map(r => `${r.name}: ${r.total.toLocaleString()} บาท`).join('\n');
  pushMessage(OWNER_LINE_USER_ID, [{ type: 'text', text: `สรุปยอดเดือน ${period}:\n${summary}` }]);

  return { ok: true, count: results.length };
}
```

---

## 6. LIFF Frontend — UI Pages

### 9 HTML pages

| Page | URL | Function |
|---|---|---|
| `register.html` | `/register` | ฟอร์มลงทะเบียน + ถ่ายรูป |
| `checkin.html` | `/checkin` | เช็คอินพร้อม GPS + กล้องสด + watermark |
| `leave.html` | `/leave` | ส่งใบลา |
| `ot.html` | `/ot` | ขอ OT |
| `balance.html` | `/balance` | ดูยอด + สิทธิ์ |
| `hr-tools.html` | `/hr-tools` | สำหรับ HR/เจ้าของ |
| `approval-inbox.html` | `/approve` | กล่องอนุมัติ (รวมรายการ pending) |
| `evidence.html` | `/evidence?id=...` | แนบหลักฐานเพิ่ม |
| `response.html` | `/respond?id=...` | LIFF response card |

### Critical client-side technique: Camera + Watermark

```javascript
// 1. เปิดกล้องสด (ห้ามใช้ gallery)
const input = document.createElement('input');
input.type = 'file';
input.accept = 'image/*';
input.capture = 'user'; // 'environment' for back camera
input.click();

input.onchange = async (e) => {
  const file = e.target.files[0];
  const img = await loadImage(file);

  // 2. Get GPS
  const pos = await getCurrentPosition();
  const { latitude, longitude } = pos.coords;

  // 3. Get datetime
  const now = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });

  // 4. Draw to canvas + watermark
  const canvas = document.createElement('canvas');
  canvas.width = Math.min(img.width, 1280);
  canvas.height = (canvas.width / img.width) * img.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  // Watermark background
  const bottomBar = 80;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, canvas.height - bottomBar, canvas.width, bottomBar);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(`📍 ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`, 15, canvas.height - bottomBar + 28);
  ctx.fillText(`🕐 ${now}`, 15, canvas.height - bottomBar + 58);

  // 5. Convert to base64
  const base64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];

  // 6. Submit
  const userId = (await liff.getProfile()).userId;
  const res = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    body: JSON.stringify({
      action: 'checkin',
      lineUserId: userId,
      lat: latitude, lng: longitude,
      selfieBase64: base64,
      slot: 'IN'
    })
  });
  const json = await res.json();
  // handle response
};
```

### Critical: GPS permission flow

```javascript
async function getGPS() {
  if (!navigator.geolocation) throw new Error('gps_not_supported');
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      resolve,
      err => {
        if (err.code === 1) reject(new Error('gps_denied'));
        else if (err.code === 3) reject(new Error('gps_timeout'));
        else reject(err);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}
```

---

## 7. LINE Setup — OA · LIFF · Rich Menu

### A. สร้าง LINE Official Account

1. ไป https://www.linebiz.com/th/entry → สมัคร LINE OA (ฟรี tier ได้)
2. ไป LINE Developers Console → สร้าง Provider + Channel (Messaging API)
3. ในแท็บ Messaging API:
   - Channel Access Token (long-lived) — เก็บไว้
   - Channel Secret — เก็บไว้
   - Webhook URL → ใส่ทีหลังหลัง deploy Apps Script
   - ปิด Auto-reply messages

### B. สร้าง LIFF Apps (จำนวน 7-9 ตัว)

ใน Channel เดียวกัน → tab LIFF → Add LIFF:

| LIFF Name | Size | Scope |
|---|---|---|
| liff-register | full | profile, openid |
| liff-checkin | full | profile, openid, **chat_message.write** |
| liff-leave | full | profile, openid |
| liff-ot | full | profile, openid |
| liff-balance | full | profile, openid |
| liff-hr-tools | full | profile, openid |
| liff-approval-inbox | full | profile, openid |
| liff-evidence | full | profile, openid |
| liff-response | tall | profile, openid |

แต่ละตัวจะได้ LIFF ID — เก็บไว้ใส่ Script Properties

### C. Rich Menu (2 ชุด)

Rich Menu สำหรับ **พนักงาน** (default):
- 5 ปุ่ม: ลงทะเบียน / เช็คอิน / ส่งใบลา / ขอ OT / ดูยอด

Rich Menu สำหรับ **เจ้าของ/HR** (assigned manually):
- 4 ปุ่ม: กล่องอนุมัติ / เครื่องมือ HR / ปิดงวด / ดูรายงาน

ใช้ LINE Manager หรือ Messaging API สร้าง rich menu

---

## 8. TASKS — Implementation Checklist

### Phase 1: Setup (4-6 ชม.)

- [ ] **T01** สร้าง Google Sheet + 11 sheets ตามที่กำหนด
- [ ] **T02** สร้าง Google Drive folder + 4 sub-folders
- [ ] **T03** เติมค่า `Config` sheet
- [ ] **T04** สร้าง LINE Official Account + Channel
- [ ] **T05** สร้าง LIFF apps 9 ตัว
- [ ] **T06** สร้าง Rich Menu 2 ชุด

### Phase 2: Apps Script Foundation (10-15 ชม.)

- [ ] **T07** สร้าง Apps Script project + ตั้ง Script Properties (12 keys)
- [ ] **T08** เขียน `Config.gs` + `Logger.gs` + `Utils.gs`
- [ ] **T09** เขียน `LineApi.gs` (push, reply, profile, verify signature)
- [ ] **T10** เขียน `DriveStore.gs` (upload + signed URL)
- [ ] **T11** เขียน `Router.gs` + `Code.gs` (doPost router)

### Phase 3: Core Handlers (20-30 ชม.)

- [ ] **T12** `Register.gs` — register()
- [ ] **T13** `Checkin.gs` — checkin() + slot validation
- [ ] **T14** `Leave.gs` — submitLeave() + quota check
- [ ] **T15** `OT.gs` — submitOT() + lead time check
- [ ] **T16** `Approval.gs` — handleApproval() state machine ⚠️ ยากสุด
- [ ] **T17** `Evidence.gs` — submitEvidence()
- [ ] **T18** `Balance.gs` — getBalance()
- [ ] **T19** `HRTools.gs` — CRUD employees / pay items / quota
- [ ] **T20** `Payment.gs` — closePeriod() + markPaid()

### Phase 4: Flex Cards (8-12 ชม.)

- [ ] **T21** `ApprovalCard.gs` — Leave approval card (4 ปุ่ม)
- [ ] **T22** `ApprovalCard.gs` — OT approval card
- [ ] **T23** `CheckinCard.gs` — checkin notification + out-of-range alert
- [ ] **T24** `ReminderCard.gs` — end-work reminder

### Phase 5: Time Triggers (4-6 ชม.)

- [ ] **T25** Late check-in alert (09:30)
- [ ] **T26** End-work reminder (17:30)
- [ ] **T27** Pending approval reminder (ทุก 2 ชม.)

### Phase 6: LIFF Frontend (15-25 ชม.)

- [ ] **T28** `register.html`
- [ ] **T29** `checkin.html` + watermark canvas
- [ ] **T30** `leave.html` + quota display
- [ ] **T31** `ot.html`
- [ ] **T32** `balance.html`
- [ ] **T33** `hr-tools.html` (multi-tab)
- [ ] **T34** `approval-inbox.html`
- [ ] **T35** `evidence.html`
- [ ] **T36** `response.html`

### Phase 7: Deploy + Test (8-15 ชม.)

- [ ] **T37** Deploy Apps Script เป็น Web App
- [ ] **T38** ตั้ง LINE Webhook URL + verify
- [ ] **T39** Test Flow 1 (Register)
- [ ] **T40** Test Flow 2-3 (Check-in 4 slot)
- [ ] **T41** Test Flow 4 (End-work reminder)
- [ ] **T42** Test Flow 5-6 (Leave + OT)
- [ ] **T43** Test Flow 7 (3-level approval — สำคัญ!)
- [ ] **T44** Test Flow 8 (Balance display)
- [ ] **T45** Test Flow 9 (HR tools)
- [ ] **T46** Test Flow 10 (Close period + payroll calc)
- [ ] **T47** Test edge cases (out of range, duplicate, expired session, etc.)

### Phase 8: Polish (5-10 ชม.)

- [ ] **T48** Error messages ทั้งหมดเป็นภาษาไทยที่ user เข้าใจ
- [ ] **T49** Loading states ใน LIFF
- [ ] **T50** Empty states (ยังไม่มีข้อมูล)

---

**รวมประมาณ:** 74-119 ชม.

---

## 9. Setup Step-by-Step

### Step 1: Clone/Setup Apps Script project

```bash
# install clasp (Apps Script CLI)
npm install -g @google/clasp
clasp login

# create new project
mkdir mini-hr-app && cd mini-hr-app
clasp create --type sheets --title "Mini HR App"
# จะได้ Sheet + Apps Script project พร้อม

# pull empty
clasp pull

# push code
clasp push
```

### Step 2: Configure Script Properties

ใน Apps Script → Project Settings → Script Properties:

```
LINE_CHANNEL_ACCESS_TOKEN=...
LINE_CHANNEL_SECRET=...
SHEET_ID=...
DRIVE_FOLDER_ID=...
OWNER_LINE_USER_ID=...
LIFF_ID_REGISTER=...
LIFF_ID_CHECKIN=...
LIFF_ID_LEAVE=...
LIFF_ID_OT=...
LIFF_ID_BALANCE=...
LIFF_ID_HR_TOOLS=...
LIFF_ID_APPROVAL=...
LIFF_ID_EVIDENCE=...
LIFF_ID_RESPONSE=...
```

### Step 3: Deploy Web App

Deploy → New deployment → Type: Web app
- Execute as: **Me**
- Who has access: **Anyone**

Copy URL → ใส่ใน LINE Developers Console → Webhook URL → Verify

### Step 4: Setup Time Triggers

Apps Script → Triggers → Add Trigger:
- Function: `endWorkReminder`, Type: Time-driven, Day timer, 17:00-18:00
- Function: `lateCheckinAlert`, Day timer, 09:00-10:00
- Function: `pendingApprovalReminder`, Hour timer, every 2 hours

### Step 5: Test signup flow

ใช้ LINE account ทดสอบเอง:
1. เพิ่มเพื่อน LINE OA
2. กด rich menu "ลงทะเบียน"
3. ลงทะเบียน → ดู Sheet `Employees` มี row ใหม่
4. แก้ approver_L1_id เป็น LINE userId ของตัวเอง (เพื่อทดสอบ self-approval)

---

## 10. Common Pitfalls

### 🚨 LIFF + GPS

- iOS Safari ต้อง **HTTPS เท่านั้น** ถึงจะให้สิทธิ์ GPS — Apps Script HtmlService รัน HTTPS อยู่แล้ว
- ถ้าโหลด LIFF ใน LINE app บางครั้ง GPS permission จะถูก deny อัตโนมัติ → ต้องไปเปิดที่ Settings > LINE
- รัศมี 150m บางวันอาจไม่พอ ถ้า GPS ห่วย — เพิ่มเป็น 200m ปลอดภัยกว่า

### 🚨 Apps Script Quotas

| Resource | Limit |
|---|---|
| Total runtime | 6 นาที/execution |
| URL fetch | 20,000 ครั้ง/วัน |
| Email | 100 ฉบับ/วัน |
| Drive API | 20,000 ครั้ง/วัน |

ถ้ามีพนักงาน > 100 คน + check-in 4 ครั้ง/วัน = 400 calls/day → ยังไหว
แต่ถ้า > 500 คน → ต้อง batch + cache

### 🚨 LINE Push Limit

- LINE OA Free tier = 1,000 push messages/เดือน (ทั้ง OA ไม่ใช่ต่อคน)
- ถ้ามีพนักงาน 50 คน × ลงเวลา 4 ครั้ง = 200 push/วัน × 22 วัน = 4,400/เดือน
- ต้องอัพเป็น Light (600 บาท/เดือน, 15,000 messages) หรือ Standard (1,500 บาท/เดือน, unlimited)

### 🚨 Webhook signature verification

```javascript
function verifyLineSignature(body, signature) {
  const channelSecret = PropertiesService.getScriptProperties()
    .getProperty('LINE_CHANNEL_SECRET');
  const hash = Utilities.computeHmacSha256Signature(body, channelSecret);
  const expected = Utilities.base64Encode(hash);
  return signature === expected;
}
```

**ห้ามข้ามขั้นตอนนี้** — ไม่งั้นใครก็ส่ง fake request เข้า webhook คุณได้

### 🚨 Image upload to Drive — base64 size

- ภาพถ่ายมือถือ raw ~3-8MB → base64 จะใหญ่กว่า ~30-40%
- LIFF post payload limit ~ 50MB แต่ Apps Script execution timeout 6 นาที
- **Resize ฝั่ง client** ก่อนส่งเสมอ (max width 1280px, JPEG quality 0.85)

### 🚨 Time zone

```javascript
// ❌ wrong
new Date().toISOString()  // UTC

// ✅ correct
Utilities.formatDate(new Date(), 'Asia/Bangkok', "yyyy-MM-dd'T'HH:mm:ssXXX")
```

### 🚨 Multi-level approval bugs

- เก็บ `approval_history` เป็น JSON string ในเซลล์เดียว — `JSON.parse` ทุกครั้งก่อนใช้
- `current_approver` ต้อง update ทุกครั้งที่ส่งต่อ — ลืมแล้วระบบ stuck
- ถ้า approver ตอนนั้นลาออก → ต้อง fallback ไป L+1 อัตโนมัติ

---

## 11. Cost & Limits

### Stack cost per month

| Item | Free tier | Light | Standard |
|---|---|---|---|
| Google Workspace | ฟรี | — | — |
| Google Drive | 15GB ฟรี | — | — |
| Apps Script | ฟรี | — | — |
| LINE OA | 1,000 msg | 15,000 msg (฿600) | unlimited (฿1,500) |
| n8n (optional) | ฟรี (self-host) | — | — |

**Realistic monthly cost สำหรับ SME 50 คน:** ~600-1,500 บาท/เดือน

### Scale limits

| Metric | Soft limit |
|---|---|
| พนักงาน | 200 คน |
| Transactions/day | 2,000 |
| Sheet rows | 100,000 (เริ่มช้าที่ ~10,000) |

ถ้าโตเกินนี้ → ย้ายไป Firestore / Supabase / Postgres

---

## 12. Definition of Done

ระบบใช้งานได้จริงเมื่อ:

- [ ] พนักงานลงทะเบียนผ่าน LINE ได้ → ข้อมูลครบในระบบ
- [ ] เช็คอิน 4 ครั้ง/วัน + GPS + selfie + watermark ทำงานได้
- [ ] ส่งใบลา 4 ประเภท + ตรวจสิทธิ์คงเหลือ + ดักลาเกินสิทธิ์ได้
- [ ] ขอ OT ล่วงหน้าได้ + ตรวจ lead time
- [ ] อนุมัติ 3 ระดับทำงานครบทุก case (approve / reject / need_info)
- [ ] ขอหลักฐานเพิ่ม + แนบกลับได้
- [ ] เตือนเลิกงาน + ไล่กลับบ้านอัตโนมัติ
- [ ] HR Tools ครบ 5 tabs
- [ ] ดูยอดของตัวเองได้ + เห็นสิทธิ์คงเหลือ
- [ ] ปิดงวด → คำนวณ payroll ถูกต้อง → แสดงสรุปยอด
- [ ] รายงานรายสัปดาห์/รายเดือน export ได้
- [ ] Logs ครบทุก action
- [ ] Webhook signature verify ทำงาน
- [ ] Error message ทุกที่เป็นภาษาไทย user-friendly

---

## ภาคผนวก: ราคาตลาด (ถ้าจ้างคนทำให้)

| Service | ราคา |
|---|---|
| ลูกค้าจ้างนักพัฒนา freelance ไทย (full stack) | 800-1,500 บาท/ชม. × 80-120 ชม. = **65,000 - 180,000 บาท** |
| ลูกค้าจ้าง dev agency | **150,000 - 400,000 บาท** |
| Moodata Project (Mini HR App package) | **30,000 บาท** (one-time) ติดตั้งสำเร็จรูปจาก template + รับประกัน 3 เดือน |
| Moodata Project + Knowhow Workshop | **45,000 บาท** (one-time) — สอนทำเป็น mini app อื่นได้ด้วย |

---

## 📞 Contact

**คุณปริวรรตน์ อรุโณทยานันท์ (พี่ปุ้ย)**
Moodata Project — บริษัท ริชมอนด์ กรุ๊ป 89 จำกัด

- 📞 061-797-8899
- 💬 LINE: w.aruno

---

*เอกสารฉบับนี้สำหรับผู้ที่สนใจศึกษาขอบเขตของ Mini HR App
ถ้าคุณอ่านมาถึงตรงนี้และคิดว่า "เออ น่าทำ" → ลุย
ถ้าคิดว่า "ยาวจัง" → ทักพี่ปุ้ยให้ติดตั้งให้ก็ได้* 😄
