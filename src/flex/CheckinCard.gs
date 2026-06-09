/**
 * ============================================================
 * Checkin notification + End-work reminder cards
 * ============================================================
 */

function buildCheckinNotifyCard(opts) {
  const emp = opts.employee;
  const slot = opts.slot;
  const distance = opts.distance;
  const selfieUrl = opts.selfieUrl;
  const time = opts.time;
  const outOfRange = opts.outOfRange;

  const headerColor = outOfRange ? '#B23A3A' : COLOR_PRIMARY;
  const headerText = outOfRange ? '⚠️ นอกรัศมี สแกน ' + thaiSlot(slot) : '✅ ลงเวลา ' + thaiSlot(slot);

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
        kvRow('พนักงาน', emp.employee_id + ' — ' + emp.display_name),
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
 * End-work reminder card (for employee still at work without approved OT)
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
        type: 'text', text: '⚠️ แจ้งเตือนเลิกงาน',
        color: '#FFFFFF', weight: 'bold', size: 'lg'
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
          text: 'ให้ออกจากออฟฟิศทันที',
          weight: 'bold',
          size: 'md',
          align: 'center',
          margin: 'sm'
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
            text: '⚠️ คำเตือนสำคัญ',
            weight: 'bold',
            size: 'sm',
            color: '#B23A3A'
          }, {
            type: 'text',
            text: 'หากไม่ได้รับอนุญาตให้ทำงานล่วงเวลา บริษัทฯ จะไม่รับผิดชอบค่าล่วงเวลาทุกกรณี',
            size: 'xs',
            wrap: true,
            margin: 'sm'
          }]
        }
      ]
    }
  };
}

function buildLateCheckinAlertCard(emp, expectedTime, actualTime) {
  return {
    type: 'bubble',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#F2A640',
      paddingAll: 'md',
      contents: [{
        type: 'text', text: '⏰ มาสายแจ้งเตือน',
        color: '#FFFFFF', weight: 'bold', size: 'lg'
      }]
    },
    body: {
      type: 'box', layout: 'vertical',
      contents: [
        kvRow('พนักงาน', emp.display_name),
        kvRow('เวลาเข้างาน', expectedTime),
        kvRow('เวลาเช็คอินจริง', actualTime || '-')
      ]
    }
  };
}
