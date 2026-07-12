/**
 * ============================================================
 * Checkin notification + end-work reminder cards
 * ============================================================
 */

function buildCheckinNotifyCard(opts) {
  const emp = opts.employee;
  const slot = opts.slot;
  const distance = opts.distance;
  const branchName = opts.branchName || '-';
  const selfieUrl = opts.selfieUrl;
  const time = opts.time;
  const outOfRange = opts.outOfRange;

  const headerColor = outOfRange ? '#B23A3A' : COLOR_PRIMARY;
  const headerText = outOfRange
    ? 'นอกรัศมี สแกน ' + thaiSlot(slot)
    : 'ลงเวลา ' + thaiSlot(slot);

  return {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: headerColor,
      paddingAll: 'md',
      contents: [
        { type: 'text', text: headerText, color: '#FFFFFF', weight: 'bold', size: 'lg' },
        { type: 'text', text: time, color: '#FFFFFF', size: 'xs', margin: 'sm' }
      ]
    },
    hero: selfieUrl ? {
      type: 'image',
      url: selfieUrl,
      size: 'full',
      aspectRatio: '1:1',
      aspectMode: 'cover'
    } : undefined,
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        kvRow('พนักงาน', emp.employee_id + ' - ' + emp.display_name),
        kvRow('สาขา', branchName),
        kvRow('ระยะ', distance + ' m' + (outOfRange ? ' (นอกรัศมี)' : '')),
        kvRow('ช่วง', thaiSlot(slot))
      ]
    }
  };
}

function thaiSlot(slot) {
  const map = {
    IN: 'กะเข้า',
    LUNCH_OUT: 'พักเที่ยง',
    LUNCH_IN: 'กลับจากพัก',
    OUT: 'เลิกงาน'
  };
  return map[slot] || slot;
}

/**
 * End-work reminder card for employees still at work without approved OT.
 */
function buildEndWorkReminderCard(emp, hasOTRequest) {
  return {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#F2A640',
      paddingAll: 'md',
      contents: [{
        type: 'text',
        text: 'แจ้งเตือนเลิกงาน',
        color: '#FFFFFF',
        weight: 'bold',
        size: 'lg'
      }]
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: 'ถึง คุณ ' + emp.display_name,
          color: COLOR_GRAY,
          size: 'sm'
        },
        {
          type: 'text',
          text: 'ถึงเวลาเลิกงานแล้ว',
          color: COLOR_PRIMARY,
          weight: 'bold',
          size: 'xl',
          align: 'center',
          margin: 'md'
        },
        {
          type: 'text',
          text: hasOTRequest
            ? 'คุณมีคำขอ OT แล้ว กรุณารออนุมัติ'
            : 'ถ้าทำงานต่อ กรุณาขอ OT ก่อน',
          weight: 'bold',
          size: 'md',
          align: 'center',
          margin: 'sm',
          wrap: true
        },
        { type: 'separator', margin: 'lg' },
        {
          type: 'box',
          layout: 'vertical',
          backgroundColor: '#FFF3CC',
          paddingAll: 'md',
          margin: 'lg',
          cornerRadius: 'md',
          contents: [{
            type: 'text',
            text: hasOTRequest
              ? 'ระบบจะไม่แจ้งเตือนซ้ำเมื่อ OT ได้รับอนุมัติ'
              : 'หากไม่ขอ OT ระบบอาจแจ้ง HR ว่ายังไม่ลงเวลาออก',
            size: 'sm',
            color: '#6B4A00',
            wrap: true
          }]
        }
      ]
    }
  };
}
