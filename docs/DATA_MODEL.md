# Data Model — 11 Sheets

โครงสร้างข้อมูลของ Mini HR App ใน Google Sheets

---

## 1. `Employees`

ข้อมูลพื้นฐานของพนักงานทุกคน

| Column | Type | Note |
|---|---|---|
| `employee_id` | string | EMP-0001 (PK) |
| `line_user_id` | string | unique, มาจาก LIFF |
| `display_name` | string | ชื่อ-นามสกุล |
| `phone` | string | |
| `email` | string | optional |
| `department` | string | |
| `position` | string | |
| `base_pay_monthly` | number | ค่าจ้างต่อเดือน |
| `ot_rate_per_hour` | number | ค่า OT/ชม. |
| `bank_name` | string | |
| `bank_account_no` | string | |
| `bank_account_name` | string | |
| `selfie_url` | string | Drive URL — ใช้เทียบหน้าตอนเช็คอิน |
| `id_card_url` | string | Drive URL |
| `approver_L1_id` | string | employee_id หัวหน้างาน |
| `approver_L2_id` | string | optional |
| `approver_L3_id` | string | optional |
| `start_date` | date | วันเริ่มงาน |
| `is_active` | boolean | TRUE = active |
| `registered_at` | datetime | |

---

## 2. `Checkins`

บันทึกการลงเวลา 4 slot/day

| Column | Type | Note |
|---|---|---|
| `checkin_id` | string | CHK-YYYYMMDD-NNNN |
| `employee_id` | string | |
| `checkin_date` | date | |
| `slot` | enum | IN / LUNCH_OUT / LUNCH_IN / OUT |
| `checkin_at` | datetime | เวลาจริงที่กด |
| `lat` | number | |
| `lng` | number | |
| `distance_m` | number | ระยะจากหน้างาน |
| `selfie_url` | string | รูปพร้อม watermark |
| `status` | enum | approved / out_of_range / rejected |
| `approved_by` | string | system / employee_id |
| `approved_at` | datetime | |

---

## 3. `Leaves`

บันทึกการลา

| Column | Type | Note |
|---|---|---|
| `leave_id` | string | LV-YYYYMMDD-NNNN |
| `employee_id` | string | |
| `leave_type` | enum | sick / personal / vacation / unpaid / emergency |
| `duration_type` | enum | full_day / half_day_morning / half_day_afternoon / hourly |
| `start_date` | date | |
| `end_date` | date | |
| `total_days` | number | คำนวณจาก working days |
| `total_hours` | number | สำหรับ hourly |
| `reason` | text | |
| `evidence_url` | string | optional |
| `status` | enum | pending_L1 / pending_L2 / pending_L3 / approved / rejected / need_info |
| `current_approver` | string | employee_id ของคนที่ต้องอนุมัติตอนนี้ |
| `approval_history` | JSON | array ของ {level, by, by_name, action, at, note} |
| `submitted_at` | datetime | |

---

## 4. `OT`

บันทึกการขอ Over-Time

| Column | Type | Note |
|---|---|---|
| `ot_id` | string | OT-YYYYMMDD-NNNN |
| `employee_id` | string | |
| `ot_date` | date | |
| `start_time` | time | HH:MM |
| `end_time` | time | HH:MM |
| `total_hours` | number | |
| `reason` | text | |
| `status` | enum | (เหมือน Leaves) |
| `current_approver` | string | |
| `approval_history` | JSON | |
| `submitted_at` | datetime | |

---

## 5. `Payments`

ผลคำนวณ payroll หลังปิดงวด

| Column | Type | Note |
|---|---|---|
| `payment_id` | string | PAY-YYYYMM-NNNN |
| `employee_id` | string | |
| `period` | string | 2026-05 |
| `work_days` | number | |
| `ot_hours` | number | |
| `base_pay` | number | dailyRate × workDays |
| `ot_pay` | number | otHours × rate × multiplier |
| `bonus` | number | จาก PayItems type=bonus |
| `deduction` | number | จาก PayItems type=deduction |
| `total_amount` | number | base + ot + bonus - deduction |
| `status` | enum | รอจ่าย / จ่ายแล้ว |
| `closed_at` | datetime | |
| `paid_at` | datetime | |
| `note` | text | |

---

## 6. `LeaveQuota`

โควต้าลาแต่ละคน/ปี

| Column | Type | Note |
|---|---|---|
| `employee_id` | string | |
| `year` | number | 2026 |
| `sick_quota` | number | default 30 |
| `sick_used` | number | |
| `personal_quota` | number | default 3 |
| `personal_used` | number | |
| `vacation_quota` | number | default 15 |
| `vacation_used` | number | |

---

## 7. `PayItems`

รายการเงินเพิ่ม/หัก ระหว่างเดือน

| Column | Type | Note |
|---|---|---|
| `item_id` | string | PI-{timestamp} |
| `employee_id` | string | empty = ใช้กับทุกคน |
| `period` | string | 2026-05 |
| `type` | enum | bonus / deduction |
| `amount` | number | บาท |
| `reason` | text | |
| `created_by` | string | LINE user ID |
| `created_at` | datetime | |

---

## 8. `Holidays`

วันหยุดประจำปี (กระทบการนับ working days)

| Column | Type | Note |
|---|---|---|
| `date` | date | |
| `name` | string | เช่น "วันแรงงานแห่งชาติ" |
| `type` | enum | public / company |

---

## 9. `Config`

key-value config — แก้ได้ตลอด ไม่ต้อง re-deploy

| Key | Default | Note |
|---|---|---|
| `company_name` | My Company | |
| `geofence_lat` | 13.7563 | latitude หน้างาน |
| `geofence_lng` | 100.5018 | longitude หน้างาน |
| `geofence_radius_m` | 150 | meters |
| `work_start` | 09:00 | |
| `work_end` | 18:00 | |
| `lunch_start` | 12:00 | |
| `lunch_end` | 13:00 | |
| `ot_rate_multiplier` | 1.5 | OT pay = baseRate × multiplier |
| `sick_quota_default` | 30 | |
| `personal_quota_default` | 3 | |
| `vacation_quota_default` | 15 | |
| `late_threshold_min` | 15 | มาสายเกินกี่นาทีถึงนับว่าสาย |
| `ot_request_lead_min` | 30 | OT ต้องขอก่อนเลิกงานกี่นาที |
| `enable_approval_L2` | true | |
| `enable_approval_L3` | true | |

---

## 10. `Logs`

audit log ทั้งระบบ (cleanup อัตโนมัติทุก 30 วัน)

| Column | Type | Note |
|---|---|---|
| `timestamp` | datetime | |
| `level` | enum | info / warn / error |
| `function` | string | |
| `user_id` | string | LINE user ID |
| `message` | string | |
| `payload` | JSON | (truncated 1000 chars) |

---

## 11. `Approvers` (optional)

ถ้าต้องการ approval rules แยกจาก Employees table
ตอนนี้ใช้ field `approver_L1/2/3_id` ใน Employees แทน

| Column | Type | Note |
|---|---|---|
| `employee_id` | string | |
| `level` | enum | L1 / L2 / L3 |
| `approver_id` | string | |
| `is_active` | boolean | |

---

## ER Diagram (simplified)

```
Employees ─── 1:N ──→ Checkins
    │
    ├── 1:N ──→ Leaves ──→ approval_history (JSON)
    ├── 1:N ──→ OT     ──→ approval_history (JSON)
    ├── 1:N ──→ Payments
    ├── 1:N ──→ LeaveQuota (per year)
    ├── 1:N ──→ PayItems (per period)
    │
    └── self-ref ──→ Employees (approver_L1/2/3_id)

Config (singleton key-value)
Holidays (date list)
Logs (append-only)
```
