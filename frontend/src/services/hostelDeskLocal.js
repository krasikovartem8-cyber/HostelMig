/**
 * Локальный режим без API: все сущности в localStorage.
 * Токен: local_<userId>. Поведение ролей как на бэкенде (админ — POST/DELETE).
 */

const STORAGE_KEY = 'hosteldesk_local_v1';
const TOKEN_PREFIX = 'local_';
const HOSTEL_MAX_ROOMS_DEFAULT = 13;

function uuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function nowIso() {
  return new Date().toISOString();
}

function httpError(status, detail) {
  const e = new Error(typeof detail === 'string' ? detail : 'error');
  e.response = { status, data: { detail } };
  return e;
}

function createDefaultDb() {
  const t = nowIso();
  const adminId = uuid();
  const userId = uuid();
  const accountantId = uuid();
  const migrationId = uuid();
  return {
    hostel_max_rooms: HOSTEL_MAX_ROOMS_DEFAULT,
    users: [
      {
        id: adminId,
        email: 'admin@hostel.com',
        password: 'admin123',
        full_name: 'Администратор',
        is_admin: true,
        is_accountant: true,
        is_migration_officer: true,
        is_active: true,
        created_at: t,
      },
      {
        id: userId,
        email: 'user@hostel.com',
        password: 'user123',
        full_name: 'Пользователь',
        is_admin: false,
        is_accountant: false,
        is_migration_officer: false,
        is_active: true,
        created_at: t,
      },
      {
        id: accountantId,
        email: 'accountant@hostel.com',
        password: 'accountant123',
        full_name: 'Бухгалтер',
        is_admin: false,
        is_accountant: true,
        is_migration_officer: false,
        is_active: true,
        created_at: t,
      },
      {
        id: migrationId,
        email: 'migration@hostel.com',
        password: 'migration123',
        full_name: 'Миграционный учёт',
        is_admin: false,
        is_accountant: false,
        is_migration_officer: true,
        created_at: t,
      },
    ],
    companies: [],
    rooms: [],
    brigades: [],
    migrants: [],
    finances: [],
  };
}

export function loadDb() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const db = createDefaultDb();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
      return db;
    }
    const parsed = JSON.parse(raw);
    if (!parsed.users || !Array.isArray(parsed.users) || parsed.users.length === 0) {
      const db = createDefaultDb();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
      return db;
    }

    // Мягкая миграция схемы localStorage (чтобы не падать после изменений)
    if (parsed.hostel_max_rooms == null) parsed.hostel_max_rooms = HOSTEL_MAX_ROOMS_DEFAULT;
    parsed.companies ||= [];
    parsed.rooms ||= [];
    parsed.brigades ||= [];
    parsed.migrants ||= [];
    parsed.finances ||= [];

    parsed.users = parsed.users.map((u) => ({
      ...u,
      is_admin: u.is_admin === true,
      is_accountant: u.is_accountant === true,
      is_migration_officer: u.is_migration_officer === true,
      is_active: u.is_active !== false,
    }));

    return parsed;
  } catch {
    const db = createDefaultDb();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    return db;
  }
}

function saveDb(db) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

export function userPayload(u) {
  return {
    id: u.id,
    email: u.email,
    full_name: u.full_name,
    role: {
      admin: u.is_admin,
      accountant: u.is_accountant === true,
      migration_officer: u.is_migration_officer === true,
    },
    is_active: u.is_active,
    created_at: u.created_at,
  };
}

export function parseLocalToken(token) {
  if (!token || typeof token !== 'string') return null;
  if (!token.startsWith(TOKEN_PREFIX)) return null;
  return token.slice(TOKEN_PREFIX.length);
}

function sessionUser(db, headers) {
  const raw = headers?.Authorization || headers?.authorization;
  if (!raw || !String(raw).startsWith('Bearer ')) return null;
  const token = String(raw).slice(7).trim();
  const id = parseLocalToken(token);
  if (!id) return null;
  return db.users.find((x) => x.id === id && x.is_active) || null;
}

function requireAuth(db, headers) {
  const u = sessionUser(db, headers);
  if (!u) throw httpError(401, 'Недействительный токен');
  return u;
}

function requireAdmin(db, headers) {
  const u = requireAuth(db, headers);
  if (!u.is_admin) {
    throw httpError(403, 'Только администратор может создавать, изменять и удалять данные');
  }
  return u;
}

function requireAdminOrAccountant(db, headers) {
  const u = requireAuth(db, headers);
  if (!u.is_admin && !u.is_accountant) {
    throw httpError(403, 'Только администратор или бухгалтер может создавать, изменять и удалять данные');
  }
  return u;
}

function companyDict(c) {
  return {
    id: c.id,
    name: c.name,
    inn: c.inn,
    kpp: c.kpp ?? null,
    legal_address: c.legal_address,
    contact_person: c.contact_person,
    contact_phone: c.contact_phone,
    contact_email: c.contact_email,
    tariff_per_day: c.tariff_per_day,
    contract_number: c.contract_number ?? null,
    contract_date: c.contract_date ?? null,
    created_at: c.created_at,
    is_active: c.is_active !== false,
  };
}

function roomDict(r) {
  return {
    id: r.id,
    room_number: r.room_number,
    floor: r.floor,
    bed_count: r.bed_count,
    occupied_beds: r.occupied_beds,
    status: r.status,
    created_at: r.created_at,
  };
}

function brigadeDict(b) {
  return {
    id: b.id,
    company_id: b.company_id,
    name: b.name,
    room_id: b.room_id ?? null,
    check_in_date: b.check_in_date,
    check_out_date: b.check_out_date ?? null,
    status: b.status === 'active' ? 'active' : 'checked_out',
    created_at: b.created_at,
    brigade_leader_id: null,
  };
}

function migrantDict(m) {
  return {
    id: m.id,
    brigade_id: m.brigade_id,
    full_name: m.full_name,
    passport_number: m.passport_number,
    passport_issued_date: m.passport_issued_date,
    passport_expiry_date: m.passport_expiry_date,
    migration_card_number: m.migration_card_number ?? null,
    migration_card_expiry: m.migration_card_expiry ?? null,
    work_patent_number: m.work_patent_number ?? null,
    work_patent_expiry: m.work_patent_expiry ?? null,
    created_at: m.created_at,
    is_active: m.is_active !== false,
  };
}

function financeDict(f) {
  return {
    id: f.id,
    company_id: f.company_id,
    type: f.type,
    amount: f.amount,
    description: f.description,
    date: f.date,
    status: f.status,
    created_at: f.created_at,
  };
}

function roomRelease(db, roomId) {
  if (!roomId) return;
  const room = db.rooms.find((r) => r.id === roomId);
  if (!room) return;
  room.occupied_beds = Math.max(0, (room.occupied_beds || 0) - 1);
  room.status = room.occupied_beds < room.bed_count ? 'available' : room.status;
}

function roomOccupy(db, roomId) {
  const room = db.rooms.find((r) => r.id === roomId);
  if (!room) throw httpError(400, 'Комната не найдена');
  if (room.occupied_beds >= room.bed_count) {
    throw httpError(400, 'Нет свободных мест в комнате');
  }
  room.occupied_beds += 1;
  room.status = room.occupied_beds >= room.bed_count ? 'occupied' : 'available';
}

export function login(email, password) {
  const db = loadDb();
  const u = db.users.find((x) => x.email === email && x.is_active);
  if (!u || u.password !== password) {
    throw httpError(401, 'Неверный email или пароль');
  }
  return {
    access_token: `${TOKEN_PREFIX}${u.id}`,
    token_type: 'bearer',
    user: userPayload(u),
  };
}

export function meFromToken(token) {
  const db = loadDb();
  const id = parseLocalToken(token);
  if (!id) throw httpError(401, 'Недействительный токен');
  const u = db.users.find((x) => x.id === id && x.is_active);
  if (!u) throw httpError(401, 'Недействительный токен');
  return userPayload(u);
}

function matchPath(path, pattern) {
  const a = path.split('/').filter(Boolean);
  const b = pattern.split('/').filter(Boolean);
  if (a.length !== b.length) return null;
  const params = {};
  for (let i = 0; i < a.length; i += 1) {
    if (b[i].startsWith(':')) {
      params[b[i].slice(1)] = a[i];
    } else if (a[i] !== b[i]) {
      return null;
    }
  }
  return params;
}

export function request(method, path, body, headers) {
  const db = loadDb();
  const p = path.startsWith('/') ? path : `/${path}`;
  const m = method.toUpperCase();

  if (m === 'GET' && p === '/auth/me') {
    const u = requireAuth(db, headers);
    return userPayload(u);
  }

  if (m === 'GET' && p === '/companies') {
    requireAuth(db, headers);
    const list = db.companies
      .filter((c) => c.is_active !== false)
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    return list.map(companyDict);
  }

  if (m === 'POST' && p === '/companies') {
    requireAdminOrAccountant(db, headers);
    const c = {
      id: uuid(),
      name: body.name,
      inn: body.inn,
      kpp: body.kpp || null,
      legal_address: body.legal_address,
      contact_person: body.contact_person,
      contact_phone: body.contact_phone,
      contact_email: body.contact_email,
      tariff_per_day: Number(body.tariff_per_day),
      contract_number: body.contract_number || null,
      contract_date: body.contract_date ? String(body.contract_date) : null,
      created_at: nowIso(),
      is_active: true,
    };
    db.companies.push(c);
    saveDb(db);
    return companyDict(c);
  }

  let mp = matchPath(p, 'companies/:companyId');
  if (m === 'DELETE' && mp) {
    requireAdminOrAccountant(db, headers);
    const { companyId } = mp;
    const c = db.companies.find((x) => x.id === companyId);
    if (!c) throw httpError(404, 'Not found');
    const brigs = db.brigades.filter((b) => b.company_id === companyId);
    if (brigs.length) {
      throw httpError(400, 'Сначала удалите бригады этой компании');
    }
    db.finances = db.finances.filter((f) => f.company_id !== companyId);
    db.companies = db.companies.filter((x) => x.id !== companyId);
    saveDb(db);
    return null;
  }

  if (m === 'GET' && p === '/rooms') {
    requireAuth(db, headers);
    const list = [...db.rooms].sort((a, b) => a.floor - b.floor || String(a.room_number).localeCompare(String(b.room_number), 'ru', { numeric: true }));
    return list.map(roomDict);
  }

  if (m === 'POST' && p === '/rooms') {
    requireAdmin(db, headers);
    const roomNumberRaw = String(body.room_number ?? '').trim();
    if (!roomNumberRaw) throw httpError(400, 'Номер комнаты обязателен');

    // Лимит: не добавлять больше доступного количества комнат (пример: 13)
    const maxRooms = Number(db.hostel_max_rooms ?? HOSTEL_MAX_ROOMS_DEFAULT);
    if (!Number.isFinite(maxRooms) || maxRooms <= 0) throw httpError(500, 'Некорректная настройка лимита комнат');
    if (db.rooms.some((x) => String(x.room_number) === roomNumberRaw)) {
      throw httpError(400, 'Комната с таким номером уже существует');
    }
    if (db.rooms.length >= maxRooms) {
      throw httpError(400, `В хостеле доступно только ${maxRooms} комнат. Дальше добавить нельзя.`);
    }

    // Если номер комнаты числовой — дополнительно ограничиваем сверху
    const asNum = Number(roomNumberRaw);
    if (Number.isFinite(asNum) && asNum > maxRooms) {
      throw httpError(400, `Нельзя добавить комнату с номером больше ${maxRooms}`);
    }

    const floor = Number(body.floor);
    const bedCount = Number(body.bed_count);
    if (!Number.isFinite(floor) || !Number.isInteger(floor)) throw httpError(400, 'Этаж должен быть целым числом');
    if (!Number.isFinite(bedCount) || !Number.isInteger(bedCount) || bedCount <= 0) {
      throw httpError(400, 'Количество койко-мест должно быть целым числом больше 0');
    }

    const r = {
      id: uuid(),
      room_number: roomNumberRaw,
      floor,
      bed_count: bedCount,
      occupied_beds: 0,
      status: 'available',
      created_at: nowIso(),
    };
    db.rooms.push(r);
    saveDb(db);
    return roomDict(r);
  }

  mp = matchPath(p, 'rooms/:roomId');
  if (m === 'DELETE' && mp) {
    requireAdmin(db, headers);
    const { roomId } = mp;
    const room = db.rooms.find((x) => x.id === roomId);
    if (!room) throw httpError(404, 'Not found');
    if (room.occupied_beds > 0) {
      throw httpError(400, 'Нельзя удалить комнату с заселением');
    }
    if (db.brigades.some((b) => b.room_id === roomId)) {
      throw httpError(400, 'Комната привязана к бригаде');
    }
    db.rooms = db.rooms.filter((x) => x.id !== roomId);
    saveDb(db);
    return null;
  }

  if (m === 'GET' && p === '/brigades') {
    requireAuth(db, headers);
    const list = [...db.brigades].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    return list.map(brigadeDict);
  }

  if (m === 'POST' && p === '/brigades') {
    requireAdmin(db, headers);
    const comp = db.companies.find((x) => x.id === body.company_id && x.is_active !== false);
    if (!comp) throw httpError(400, 'Компания не найдена');
    const name = String(body.name ?? '').trim();
    if (!name) throw httpError(400, 'Название бригады обязательно');

    const checkIn = body.check_in_date ? new Date(body.check_in_date) : null;
    if (!checkIn || !Number.isFinite(checkIn.getTime())) throw httpError(400, 'Некорректная дата заселения');

    const rid = body.room_id && String(body.room_id).trim() ? String(body.room_id).trim() : null;
    if (rid) roomOccupy(db, rid);
    const b = {
      id: uuid(),
      company_id: body.company_id,
      name,
      room_id: rid,
      check_in_date: checkIn.toISOString(),
      check_out_date: null,
      status: 'active',
      created_at: nowIso(),
    };
    db.brigades.push(b);
    saveDb(db);
    return brigadeDict(b);
  }

  mp = matchPath(p, 'brigades/:brigadeId');
  if (m === 'DELETE' && mp) {
    requireAdmin(db, headers);
    const { brigadeId } = mp;
    const b = db.brigades.find((x) => x.id === brigadeId);
    if (!b) throw httpError(404, 'Not found');
    db.migrants = db.migrants.filter((m) => m.brigade_id !== brigadeId);
    roomRelease(db, b.room_id);
    db.brigades = db.brigades.filter((x) => x.id !== brigadeId);
    saveDb(db);
    return null;
  }

  if (m === 'GET' && p === '/migrants') {
    requireAuth(db, headers);
    const list = db.migrants
      .filter((m) => m.is_active !== false)
      .sort((a, b) => a.full_name.localeCompare(b.full_name, 'ru'));
    return list.map(migrantDict);
  }

  if (m === 'POST' && p === '/migrants') {
    requireAdmin(db, headers);
    const br = db.brigades.find((x) => x.id === body.brigade_id);
    if (!br) throw httpError(400, 'Бригада не найдена');
    if (br.status !== 'active') throw httpError(400, 'Нельзя добавлять мигранта в выселенную бригаду');

    const fullName = String(body.full_name ?? '').trim();
    const passportNumber = String(body.passport_number ?? '').trim();
    if (!fullName) throw httpError(400, 'ФИО мигранта обязательно');
    if (!passportNumber) throw httpError(400, 'Номер паспорта обязателен');

    const issued = body.passport_issued_date ? new Date(body.passport_issued_date) : null;
    const expiry = body.passport_expiry_date ? new Date(body.passport_expiry_date) : null;
    if (!issued || !Number.isFinite(issued.getTime())) throw httpError(400, 'Некорректная дата выдачи паспорта');
    if (!expiry || !Number.isFinite(expiry.getTime())) throw httpError(400, 'Некорректный срок действия паспорта');
    if (expiry.getTime() < issued.getTime()) throw httpError(400, 'Срок действия паспорта не может быть раньше даты выдачи');

    const cardExpiry = body.migration_card_expiry ? new Date(body.migration_card_expiry) : null;
    const patentExpiry = body.work_patent_expiry ? new Date(body.work_patent_expiry) : null;
    if (cardExpiry && !Number.isFinite(cardExpiry.getTime())) throw httpError(400, 'Некорректная дата окончания миграционной карты');
    if (patentExpiry && !Number.isFinite(patentExpiry.getTime())) throw httpError(400, 'Некорректная дата окончания патента');

    const m = {
      id: uuid(),
      brigade_id: body.brigade_id,
      full_name: fullName,
      passport_number: passportNumber,
      passport_issued_date: issued.toISOString(),
      passport_expiry_date: expiry.toISOString(),
      migration_card_number: body.migration_card_number ? String(body.migration_card_number).trim() : null,
      migration_card_expiry: cardExpiry ? cardExpiry.toISOString() : null,
      work_patent_number: body.work_patent_number ? String(body.work_patent_number).trim() : null,
      work_patent_expiry: patentExpiry ? patentExpiry.toISOString() : null,
      created_at: nowIso(),
      is_active: true,
    };
    db.migrants.push(m);
    saveDb(db);
    return migrantDict(m);
  }

  mp = matchPath(p, 'migrants/:migrantId');
  if (m === 'DELETE' && mp) {
    requireAdmin(db, headers);
    const { migrantId } = mp;
    const mig = db.migrants.find((x) => x.id === migrantId);
    if (!mig) throw httpError(404, 'Not found');
    db.migrants = db.migrants.filter((x) => x.id !== migrantId);
    saveDb(db);
    return null;
  }

  if (m === 'GET' && p === '/finances') {
    requireAuth(db, headers);
    const list = [...db.finances].sort((a, b) => String(b.date).localeCompare(String(a.date)));
    return list.map(financeDict);
  }

  if (m === 'POST' && p === '/finances') {
    requireAdminOrAccountant(db, headers);
    const comp = db.companies.find((x) => x.id === body.company_id && x.is_active !== false);
    if (!comp) throw httpError(400, 'Компания не найдена');

    const allowedTypes = ['invoice', 'payment', 'debt'];
    const allowedStatuses = ['pending', 'paid', 'overdue'];
    const type = String(body.type ?? '').trim();
    const status = String(body.status ?? '').trim();
    if (!allowedTypes.includes(type)) throw httpError(400, 'Некорректный тип финансовой записи');
    if (!allowedStatuses.includes(status)) throw httpError(400, 'Некорректный статус финансовой записи');

    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw httpError(400, 'Сумма должна быть числом больше 0');

    const description = String(body.description ?? '').trim();
    if (!description) throw httpError(400, 'Описание обязательно');

    const f = {
      id: uuid(),
      company_id: body.company_id,
      type,
      amount,
      description,
      date: nowIso(),
      status,
      created_at: nowIso(),
    };
    db.finances.push(f);
    saveDb(db);
    return financeDict(f);
  }

  mp = matchPath(p, 'finances/:recordId');
  if (m === 'DELETE' && mp) {
    requireAdminOrAccountant(db, headers);
    const { recordId } = mp;
    const f = db.finances.find((x) => x.id === recordId);
    if (!f) throw httpError(404, 'Not found');
    db.finances = db.finances.filter((x) => x.id !== recordId);
    saveDb(db);
    return null;
  }

  if (m === 'GET' && p === '/dashboard/stats') {
    requireAuth(db, headers);
    const total_companies = db.companies.filter((c) => c.is_active !== false).length;
    const total_brigades = db.brigades.filter((b) => b.status === 'active').length;
    const total_migrants = db.migrants.filter((m) => m.is_active !== false).length;
    const maxRooms = Number(db.hostel_max_rooms ?? HOSTEL_MAX_ROOMS_DEFAULT);
    const total_rooms = Number.isFinite(maxRooms) && maxRooms > 0 ? maxRooms : db.rooms.length;
    const occupied_rooms = db.rooms.filter((r) => (r.occupied_beds || 0) > 0 || r.status === 'occupied').length;
    const available_rooms = Math.max(0, total_rooms - occupied_rooms);
    const occupancy_rate = total_rooms ? Math.round((occupied_rooms / total_rooms) * 1000) / 10 : 0;
    let total_revenue = 0;
    let pending_payments = 0;
    for (const f of db.finances) {
      if (f.status === 'paid') total_revenue += f.amount;
      if (f.status === 'pending') pending_payments += f.amount;
    }
    const now = new Date();
    const soon = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
    let expiring_documents = 0;
    for (const m of db.migrants) {
      if (m.is_active === false) continue;
      const dates = [m.passport_expiry_date, m.work_patent_expiry].filter(Boolean);
      for (const ds of dates) {
        const d = new Date(ds);
        if (!Number.isFinite(d.getTime())) continue;
        if (d >= now && d <= soon) {
          expiring_documents += 1;
          break;
        }
      }
    }
    return {
      total_companies,
      total_brigades,
      total_migrants,
      total_rooms,
      available_rooms,
      occupancy_rate,
      total_revenue,
      pending_payments,
      expiring_documents,
    };
  }

  if (m === 'GET' && p === '/dashboard/activity') {
    requireAuth(db, headers);
    const typeRu = { invoice: 'счёт', payment: 'платёж', debt: 'задолженность' };
    const items = [];
    for (const c of db.companies.filter((x) => x.is_active !== false)) {
      items.push({
        kind: 'company',
        created_at: c.created_at,
        title: c.name,
        detail: 'Добавлена компания',
      });
    }
    for (const room of db.rooms) {
      items.push({
        kind: 'room',
        created_at: room.created_at,
        title: `Комната ${room.room_number}`,
        detail: 'Добавлена комната',
      });
    }
    for (const b of db.brigades) {
      items.push({
        kind: 'brigade',
        created_at: b.created_at,
        title: b.name,
        detail: 'Создана бригада',
      });
    }
    for (const mig of db.migrants) {
      items.push({
        kind: 'migrant',
        created_at: mig.created_at,
        title: mig.full_name,
        detail: 'Добавлен мигрант',
      });
    }
    for (const f of db.finances) {
      const desc = (f.description || '').trim() || 'Без описания';
      const title = desc.length > 80 ? `${desc.slice(0, 80)}…` : desc;
      const amt = typeof f.amount === 'number' ? f.amount : parseFloat(f.amount);
      items.push({
        kind: 'finance',
        created_at: f.created_at,
        title,
        detail: `Финансы: ${typeRu[f.type] || f.type}, ₽${Number.isFinite(amt) ? amt : f.amount}`,
      });
    }
    items.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    return items.slice(0, 25);
  }

  throw httpError(404, 'Not found');
}
