# Troubleshooting

ปัญหาที่เจอบ่อยและวิธีแก้

---

## GPS issues

### "ต้องเปิด GPS permission" บน iPhone

1. Settings → LINE → Location → While Using
2. Settings → Safari → Location → Allow
3. ใน LIFF เปิดด้วย LINE app (ห้ามใช้ external browser)

### GPS timeout บ่อยมาก

- ออกไปข้างนอกที่โล่ง (ในตึกหนา GPS ไม่ค่อยจับ)
- เพิ่ม timeout: `{ timeout: 30000 }` ใน `checkin.html`
- เพิ่มรัศมีใน Config: `geofence_radius_m` จาก 150 → 200-300

### พิกัด GPS เพี้ยน

- ใน Config ลองเปลี่ยน `enableHighAccuracy: false`
- ใช้ wifi based location แทน (ไม่แม่นแต่เร็วกว่า)

---

## Apps Script issues

### "Service Spreadsheets failed while accessing document"

- Apps Script ไม่ได้ permission Sheet
- ไปที่ Apps Script Editor → Run any function → Approve permissions ใหม่

### "Exceeded maximum execution time" (6 min)

- function ทำงานนาน > 6 นาที — เกือบทุกครั้งเกิดจาก loop ใน data > 5,000 rows
- แก้ที่ getAllRows + filter ให้ใช้ index หรือ batch
- ใช้ ScriptApp.newTrigger สำหรับงานยาว → resume ทีหลัง

### "URL Fetch limit exceeded"

- หลังเรียก LINE API > 20,000 ครั้ง/วัน
- ตรวจ Logs sheet — มี loop ที่ส่ง push ซ้ำๆ ไหม
- รอวันรุ่งขึ้น quota จะ reset

### deploy แล้ว LIFF ไม่ทำงาน

- เช็คว่า Deploy ใช้ **Anyone** access (ไม่ใช่ Anyone with Google account)
- ถ้าแก้โค้ดแล้ว — ต้อง **New deployment** (ไม่ใช่ Edit) เพื่อให้ URL อัพเดท
- หรือใช้ deployment เดิม → Manage deployments → ปุ่ม edit → Version: New version

---

## LINE Messaging API issues

### Webhook verify ไม่ผ่าน

- เช็คว่า Apps Script Web App URL เปิดได้ใน browser → ต้องได้ JSON output
- ลองส่ง POST request เปล่า — ต้องไม่ error 500
- LINE webhook ต้อง response 200 ภายใน timeout (~ไม่กี่วินาที)

### Push limit เต็ม

- LINE OA Free = 1,000 msg/เดือน (ทั้งหมด ไม่ใช่ต่อคน)
- ถ้ามีพนักงาน > 20 คน ใช้ flow ครบ → จะเต็มภายในสัปดาห์เดียว
- Upgrade เป็น Light (600 บาท/เดือน, 15,000 msg) ทันที

### Flex Card ไม่ขึ้น

- เช็ค JSON validity ที่ https://developers.line.biz/flex-simulator/
- ขนาด JSON เกิน 25 KB ไม่ได้
- nested boxes ไม่ควรเกิน 10 ชั้น

### postback ไม่ trigger

- เช็คว่า rich menu / flex card action type = `postback` (ไม่ใช่ message)
- เช็ค URL ของ webhook ใน LINE Console — ต้องเป็น URL ปัจจุบันของ deployment

---

## LIFF issues

### LIFF login loop ไม่จบ

- เคลียร์ cache LIFF: liff.logout() แล้ว reload
- หรือใน LIFF settings ตั้ง scope ให้ตรง (profile, openid)
- ถ้าใช้ Apps Script HtmlService — sandbox mode ต้อง IFRAME

### "liff is not defined"

- ตรวจ `<script src="https://static.line-scdn.net/liff/edge/2/sdk.js">` ก่อน code อื่น
- script defer/async อาจทำให้โหลดช้า — ใช้ await liff.init({...})

### file upload (camera) ไม่เด้งกล้องสด

- iOS Safari: ต้องใช้ `capture="user"` (selfie) หรือ `capture="environment"` (กล้องหลัง)
- iOS Safari < 11 ไม่ support capture attribute (rare นะปัจจุบัน)

---

## CORS / Apps Script gotchas

### "blocked by CORS policy"

- Apps Script Web App ไม่ส่ง CORS headers — ต้อง avoid preflight
- ใช้ `Content-Type: text/plain` แทน `application/json`
- ห้ามใส่ custom headers (Authorization, X-*)

```javascript
fetch(URL, {
  method: 'POST',
  headers: { 'Content-Type': 'text/plain' },  // ← KEY!
  body: JSON.stringify(payload)
});
```

### "missing_property" error

- ลืมตั้ง Script Property ใน Apps Script
- ไป Project Settings → Script Properties → เพิ่ม key ที่ขาด

---

## Image / Drive issues

### รูปจาก Drive ขึ้น "Sign in required"

- เช็คว่า `uploadImage` มี `setSharing(ANYONE_WITH_LINK, VIEW)`
- หรือไปที่ Drive → คลิกขวา folder → Share → Anyone with the link

### รูปขนาดใหญ่ทำให้ Apps Script timeout

- ปัญหาที่ฝั่ง LIFF resize ก่อน:
  ```javascript
  canvas.toDataURL('image/jpeg', 0.85);  // quality 0.85
  ```
- ตั้ง maxWidth = 1280px ก่อนแปลง base64

---

## Multi-level approval bugs

### คำขอติด pending ไม่ขยับ

- เช็ค Sheet `Logs` หา error
- เช็คว่า `current_approver` ตรงกับ `approver_LX_id` ของพนักงาน
- ถ้า approver ลาออก (is_active=false) → ระบบ stuck — ต้อง override manual

### กดอนุมัติ 2 รอบ → status เพี้ยน

- มี race condition ระหว่าง 2 ปุ่มกดพร้อมกัน
- TODO: ใช้ LockService:
  ```javascript
  const lock = LockService.getScriptLock();
  lock.tryLock(5000);
  try { /* ... */ } finally { lock.releaseLock(); }
  ```

---

## Performance

### หลายคนกด check-in พร้อมกัน → ช้า

- Google Sheet มี contention เมื่อมี > 5 concurrent writes
- ใช้ CacheService สำหรับ read-heavy ops
- พิจารณาย้ายไป Firestore ถ้า > 100 พนักงาน

### Sheet โหลดช้า

- ลบ rows เก่าใน `Logs` (cleanupOldLogs)
- archive old Checkins/Leaves เป็น Sheet แยกรายปี

---

## ติดอยู่นานๆ?

ทักได้ครับ:

**คุณปริวรรตน์ อรุโณทยานันท์ (พี่ปุ้ย)**
LINE: w.aruno · 061-797-8899

หรือซื้อ workshop +15,000 บาท แล้วผมสอนเต็ม max 1 วัน 😄
