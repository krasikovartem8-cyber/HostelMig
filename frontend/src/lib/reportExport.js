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

function htmlEscape(s) {
  if (s == null || s === '') return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function downloadHtml(filename, htmlContent) {
  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.replace(/[/\\?%*:|"<>]/g, '-');
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Бланки для внутреннего учёта: уведомление о прибытии / регистрация по месту пребывания (по каждому мигранту).
 */
export function buildTemporaryStayRegistrationHtml(migrants, brigades, companies, roomNumberById) {
  const companyById = Object.fromEntries((companies || []).map((c) => [c.id, c]));
  const brigadeById = Object.fromEntries((brigades || []).map((b) => [b.id, b]));

  const blocks = (migrants || []).map((m) => {
    const b = brigadeById[m.brigade_id];
    const comp = b ? companyById[b.company_id] : null;
    const roomNo =
      b?.room_id && roomNumberById && roomNumberById[b.room_id] != null
        ? String(roomNumberById[b.room_id])
        : b?.room_id
          ? '—'
          : '—';
    const addr = comp?.legal_address ? htmlEscape(comp.legal_address) : '_______________________________';
    const org = comp ? htmlEscape(comp.name) : '_______________________________';
    const inn = comp?.inn ? htmlEscape(comp.inn) : '_______';

    return `
    <section class="form-block">
      <h2>Уведомление о прибытии / регистрация временного пребывания</h2>
      <p class="hint">Внутренний бланк для учёта хостела. При подаче в орган миграционного учёта заполните поля по актуальным требованиям 109-ФЗ.</p>
      <table class="fields">
        <tr><td class="l">ФИО</td><td class="v">${htmlEscape(m.full_name)}</td></tr>
        <tr><td class="l">Гражданство</td><td class="v">${m.citizenship ? htmlEscape(m.citizenship) : '—'}</td></tr>
        <tr><td class="l">Документ (паспорт), номер</td><td class="v">${htmlEscape(m.passport_number)}</td></tr>
        <tr><td class="l">Дата выдачи паспорта</td><td class="v">${htmlEscape(formatDateRu(m.passport_issued_date))}</td></tr>
        <tr><td class="l">Срок действия паспорта</td><td class="v">${htmlEscape(formatDateRu(m.passport_expiry_date))}</td></tr>
        <tr><td class="l">Миграционная карта (номер)</td><td class="v">${htmlEscape(m.migration_card_number) || '—'}</td></tr>
        <tr><td class="l">Срок миграционной карты</td><td class="v">${m.migration_card_expiry ? htmlEscape(formatDateRu(m.migration_card_expiry)) : '—'}</td></tr>
        <tr><td class="l">Патент (номер)</td><td class="v">${htmlEscape(m.work_patent_number) || '—'}</td></tr>
        <tr><td class="l">Срок патента</td><td class="v">${m.work_patent_expiry ? htmlEscape(formatDateRu(m.work_patent_expiry)) : '—'}</td></tr>
        <tr><td class="l">Бригада (учёт)</td><td class="v">${b ? htmlEscape(b.name) : '—'}</td></tr>
        <tr><td class="l">Организация (работодатель), ИНН</td><td class="v">${org}, ИНН ${inn}</td></tr>
        <tr><td class="l">Юридический адрес организации</td><td class="v">${addr}</td></tr>
        <tr><td class="l">Комната в хостеле (номер)</td><td class="v">${htmlEscape(roomNo)}</td></tr>
        <tr><td class="l">Дата заселения (по учёту)</td><td class="v">${b ? htmlEscape(formatDateRu(b.check_in_date)) : '—'}</td></tr>
      </table>
      <div class="manual">
        <p><span class="lbl">Срок пребывания (с):</span> «____» __________ 20___ г.</p>
        <p><span class="lbl">Срок пребывания (по):</span> «____» __________ 20___ г.</p>
        <p><span class="lbl">Адрес места пребывания (фактический, для миграционного учёта):</span></p>
        <div class="line">________________________________________________________________________________</div>
        <p><span class="lbl">Дата и время прибытия к месту пребывания:</span> «____» __________ 20___ г. _____ ч. _____ мин.</p>
        <p><span class="lbl">Отметки сотрудника миграционного учёта / подпись:</span></p>
        <div class="line">________________________________________________________________________________</div>
      </div>
    </section>`;
  });

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <title>${migrants.length === 1 ? 'Регистрация временного пребывания' : 'Регистрация временного пребывания — мигранты'}</title>
  <style>
    body { font-family: 'Segoe UI', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #111; max-width: 800px; margin: 24px auto; padding: 0 16px; }
    h1 { font-size: 1.25rem; margin-bottom: 1rem; }
    h2 { font-size: 1.05rem; margin: 0 0 0.5rem 0; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
    .hint { font-size: 0.85rem; color: #555; margin: 0 0 12px 0; }
    .form-block { page-break-inside: avoid; margin-bottom: 2.5rem; padding-bottom: 1rem; border-bottom: 1px dashed #bbb; }
    .form-block:last-child { border-bottom: none; }
    table.fields { width: 100%; border-collapse: collapse; margin: 12px 0; }
    table.fields td { padding: 6px 8px; vertical-align: top; border: 1px solid #ddd; }
    table.fields td.l { width: 38%; background: #f8f9fa; font-weight: 600; }
    table.fields td.v { }
    .manual { margin-top: 14px; }
    .manual p { margin: 8px 0; }
    .lbl { font-weight: 600; }
    .line { border-bottom: 1px solid #333; min-height: 1.2em; margin: 4px 0 12px 0; }
    @media print {
      body { margin: 12mm; }
      .form-block { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <h1>${
    (migrants || []).length === 1
      ? `Бланк: регистрация временного пребывания — ${htmlEscape((migrants[0] && migrants[0].full_name) || '')}`
      : 'Бланки: регистрация временного пребывания (все мигранты)'
  }</h1>
  <p style="color:#666;font-size:10pt;">Сформировано: ${htmlEscape(new Date().toLocaleString('ru-RU'))}</p>
  ${blocks.join('\n')}
</body>
</html>`;
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
    'Гражданство',
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
    m.citizenship || '—',
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
