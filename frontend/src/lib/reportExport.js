/** Экспорт отчётов в CSV (UTF-8 с BOM — корректно в Excel на Windows). */

const SEP = ';';

export function csvEscape(cell) {
  const s = cell == null || cell === '' ? '' : String(cell);
  if (/[;\n\r"]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function rowsToCsv(headerRow, dataRows) {
  const lines = [
    headerRow.map(csvEscape).join(SEP),
    ...dataRows.map((row) => row.map(csvEscape).join(SEP)),
  ];
  return `\uFEFF${lines.join('\r\n')}`;
}

export function downloadCsv(filename, csvContent) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.replace(/[/\\?%*:|"<>]/g, '-');
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function formatDateRu(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return '';
    return d.toLocaleDateString('ru-RU');
  } catch {
    return String(iso);
  }
}

function financeTypeRu(t) {
  if (t === 'invoice') return 'Счёт';
  if (t === 'payment') return 'Платёж';
  if (t === 'debt') return 'Задолженность';
  return t;
}

function financeStatusRu(s) {
  if (s === 'pending') return 'Ожидает';
  if (s === 'paid') return 'Оплачено';
  if (s === 'overdue') return 'Просрочено';
  return s;
}

function brigadeStatusRu(s) {
  if (s === 'active') return 'Активна';
  if (s === 'checked_out') return 'Выселена';
  return s;
}

function roomStatusRu(s) {
  if (s === 'available') return 'Доступна';
  if (s === 'occupied') return 'Занята';
  if (s === 'maintenance') return 'Обслуживание';
  return s;
}

export function buildOccupancyCsv(rooms) {
  const header = [
    'Комната',
    'Этаж',
    'Коек всего',
    'Занято',
    'Свободно',
    'Статус',
    'Загрузка %',
  ];
  const rows = rooms.map((r) => {
    const free = Math.max(0, (r.bed_count || 0) - (r.occupied_beds || 0));
    const pct =
      r.bed_count > 0
        ? `${Math.round(((r.occupied_beds || 0) / r.bed_count) * 1000) / 10}%`
        : '—';
    return [
      r.room_number,
      r.floor,
      r.bed_count,
      r.occupied_beds ?? 0,
      free,
      roomStatusRu(r.status),
      pct,
    ];
  });
  return rowsToCsv(header, rows);
}

export function buildFinancesCsv(finances, companyNameById) {
  const header = ['Дата', 'Компания', 'Тип', 'Сумма', 'Описание', 'Статус'];
  const rows = finances.map((f) => [
    formatDateRu(f.date),
    companyNameById[f.company_id] || f.company_id,
    financeTypeRu(f.type),
    typeof f.amount === 'number' ? f.amount.toFixed(2) : f.amount,
    f.description,
    financeStatusRu(f.status),
  ]);
  return rowsToCsv(header, rows);
}

export function buildCompaniesBrigadesCsv(companies, brigades) {
  const header = [
    'Компания',
    'ИНН',
    'Телефон',
    'Email',
    'Бригада',
    'Статус бригады',
    'Дата заселения',
    'Комната (id)',
  ];
  const rows = [];
  for (const c of companies) {
    const cBrig = brigades.filter((b) => b.company_id === c.id);
    if (cBrig.length === 0) {
      rows.push([c.name, c.inn, c.contact_phone, c.contact_email, '—', '—', '—', '—']);
    } else {
      for (const b of cBrig) {
        rows.push([
          c.name,
          c.inn,
          c.contact_phone,
          c.contact_email,
          b.name,
          brigadeStatusRu(b.status),
          formatDateRu(b.check_in_date),
          b.room_id || '—',
        ]);
      }
    }
  }
  return rowsToCsv(header, rows);
}

export function buildMigrantsCsv(migrants, brigadeNameById) {
  const header = [
    'ФИО',
    'Бригада',
    'Паспорт',
    'Выдача паспорта',
    'Окончание паспорта',
    'Мигр. карта',
    'Окончание карты',
    'Патент',
    'Окончание патента',
  ];
  const rows = migrants.map((m) => [
    m.full_name,
    brigadeNameById[m.brigade_id] || m.brigade_id,
    m.passport_number,
    formatDateRu(m.passport_issued_date),
    formatDateRu(m.passport_expiry_date),
    m.migration_card_number || '—',
    formatDateRu(m.migration_card_expiry),
    m.work_patent_number || '—',
    formatDateRu(m.work_patent_expiry),
  ]);
  return rowsToCsv(header, rows);
}

export function buildBrigadesCsv(brigades, companyNameById, roomNumberById) {
  const header = [
    'Название',
    'Компания',
    'Статус',
    'Заселение',
    'Выселение',
    'Комната',
  ];
  const rows = brigades.map((b) => [
    b.name,
    companyNameById[b.company_id] || b.company_id,
    brigadeStatusRu(b.status),
    formatDateRu(b.check_in_date),
    formatDateRu(b.check_out_date),
    b.room_id ? roomNumberById[b.room_id] || b.room_id : '—',
  ]);
  return rowsToCsv(header, rows);
}

function daysUntil(iso) {
  if (!iso) return null;
  const end = new Date(iso);
  if (!Number.isFinite(end.getTime())) return null;
  const now = new Date();
  return Math.ceil((end - now) / 86400000);
}

export function buildExpiringDocumentsCsv(migrants, brigadeNameById, horizonDays = 30) {
  const header = [
    'ФИО',
    'Бригада',
    'Документ',
    'Дата окончания',
    'Дней до окончания',
    'Примечание',
  ];
  const now = new Date();
  const horizon = new Date(now.getTime() + horizonDays * 86400000);
  const rows = [];

  for (const m of migrants) {
    const pairs = [
      ['Паспорт', m.passport_expiry_date],
      ['Патент', m.work_patent_expiry],
      ['Миграционная карта', m.migration_card_expiry],
    ];
    for (const [label, iso] of pairs) {
      if (!iso) continue;
      const d = new Date(iso);
      if (!Number.isFinite(d.getTime())) continue;
      if (d > horizon) continue;
      const days = daysUntil(iso);
      let note = '';
      if (days < 0) note = 'Просрочен';
      else if (days <= horizonDays) note = `В течение ${horizonDays} дн.`;
      rows.push([
        m.full_name,
        brigadeNameById[m.brigade_id] || m.brigade_id,
        label,
        formatDateRu(iso),
        days == null ? '—' : String(days),
        note,
      ]);
    }
  }

  if (rows.length === 0) {
    rows.push(['—', '—', 'Нет записей в горизонте', '—', '—', '']);
  }

  return rowsToCsv(header, rows);
}

export function buildFinancesPeriodCsv(finances, companyNameById, dateFromStr, dateToStr) {
  let from = dateFromStr ? new Date(dateFromStr) : null;
  let to = dateToStr ? new Date(dateToStr) : null;
  if (from && !Number.isFinite(from.getTime())) {
    throw new Error('Некорректная дата начала');
  }
  if (to && !Number.isFinite(to.getTime())) {
    throw new Error('Некорректная дата окончания');
  }
  if (to) {
    to = new Date(to);
    to.setHours(23, 59, 59, 999);
  }

  const filtered = finances.filter((f) => {
    const d = new Date(f.date);
    if (!Number.isFinite(d.getTime())) return false;
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  });

  const base = buildFinancesCsv(filtered, companyNameById);
  const note =
    dateFromStr || dateToStr
      ? `Период: ${dateFromStr || '…'} — ${dateToStr || '…'}; записей: ${filtered.length}`
      : `Все записи; всего: ${filtered.length}`;
  return { csv: base, meta: note, count: filtered.length };
}
