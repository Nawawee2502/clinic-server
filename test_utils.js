function getThailandTime() {
    const now = new Date();
    // ✅ ใช้ Intl.DateTimeFormat เพื่อดึงเวลาไทยโดยตรง
    const thailandTimeStr = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Bangkok',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }).formatToParts(now);

    // ✅ สร้าง Date object จากเวลาไทย
    const year = parseInt(thailandTimeStr.find(p => p.type === 'year').value);
    const month = parseInt(thailandTimeStr.find(p => p.type === 'month').value) - 1; // month is 0-indexed
    const day = parseInt(thailandTimeStr.find(p => p.type === 'day').value);
    const hour = parseInt(thailandTimeStr.find(p => p.type === 'hour').value);
    const minute = parseInt(thailandTimeStr.find(p => p.type === 'minute').value);
    const second = parseInt(thailandTimeStr.find(p => p.type === 'second').value);

    // ✅ สร้าง Date object โดยใช้เวลาไทย
    const thailandDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
    return new Date(thailandDateStr + '+07:00'); // ✅ ระบุ timezone เป็น +07:00
}

function formatDateForDB(date) {
    const dateStr = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Bangkok',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(date);

    return dateStr;
}

try {
    const time = getThailandTime();
    console.log('Time:', time);
    const dbDate = formatDateForDB(time);
    console.log('DB Date:', dbDate);
} catch (e) {
    console.error('Error:', e);
}
