import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiGet, apiPost, apiDelete } from '../lib/hostelClient';
import { Plus, UserCheck, Calendar, AlertCircle, Trash2, Pencil, FileText } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { buildTemporaryStayRegistrationHtml, downloadHtml } from '../lib/reportExport';

const MIGRANT_OVERRIDES_KEY = 'migrant_local_overrides_v1';

const stampDay = () => new Date().toISOString().slice(0, 10);

const Migrants = () => {
  const { getAuthHeader, isAdmin, isMigrationOfficer, loading: authLoading } = useAuth();
  const hideMigrantSection = !isAdmin && !isMigrationOfficer; // сотрудник и бухгалтер: только просмотр других разделов
  const canEditMigrant = isAdmin || isMigrationOfficer; // админ и миграционный учёт: можно добавлять/удалять
  const [migrants, setMigrants] = useState([]);
  const [brigades, setBrigades] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [overrides, setOverrides] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(MIGRANT_OVERRIDES_KEY) || '{}');
    } catch {
      return {};
    }
  });
  const [formData, setFormData] = useState({
    brigade_id: '',
    full_name: '',
    citizenship: '',
    passport_number: '',
    passport_issued_date: '',
    passport_expiry_date: '',
    migration_card_number: '',
    migration_card_expiry: '',
    work_patent_number: '',
    work_patent_expiry: ''
  });
  const [editData, setEditData] = useState({
    brigade_id: '',
    full_name: '',
    citizenship: '',
    passport_number: '',
    passport_issued_date: '',
    passport_expiry_date: '',
    migration_card_number: '',
    migration_card_expiry: '',
    work_patent_number: '',
    work_patent_expiry: ''
  });

  const loadData = useCallback(async () => {
    try {
      const h = { headers: getAuthHeader() };
      const [migrantsRes, brigadesRes, companiesRes, roomsRes] = await Promise.all([
        apiGet('/migrants', h),
        apiGet('/brigades', h),
        apiGet('/companies', h),
        apiGet('/rooms', h),
      ]);
      setMigrants(migrantsRes.data);
      setBrigades(brigadesRes.data);
      setCompanies(companiesRes.data);
      setRooms(roomsRes.data);
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  }, [getAuthHeader]);

  useEffect(() => {
    // Не грузим данные мигрантов, если секция скрыта по ролям.
    if (hideMigrantSection) return;
    loadData();
  }, [loadData, hideMigrantSection]);

  useEffect(() => {
    localStorage.setItem(MIGRANT_OVERRIDES_KEY, JSON.stringify(overrides));
  }, [overrides]);

  const effectiveMigrants = useMemo(
    () => migrants.map((m) => ({ ...m, ...(overrides[m.id] || {}) })),
    [migrants, overrides]
  );

  const roomNumberById = useMemo(
    () => Object.fromEntries((rooms || []).map((r) => [r.id, String(r.room_number)])),
    [rooms]
  );

  const downloadRegistrationFormOne = (migrant) => {
    try {
      const html = buildTemporaryStayRegistrationHtml(
        [migrant],
        brigades,
        companies,
        roomNumberById
      );
      const safe = String(migrant.full_name || 'migrant')
        .slice(0, 48)
        .replace(/[/\\?%*:|"<>]/g, '-')
        .trim();
      downloadHtml(`registraciya-${safe}-${stampDay()}.html`, html);
      toast.success('Бланк скачан');
    } catch (e) {
      console.error(e);
      toast.error('Не удалось сформировать бланк');
    }
  };

  const normalizeDocNumber = (value) => String(value || '').trim();

  const validateDoc = (value, { required = false, label, re, min = 1, max = 64 } = {}) => {
    const v = normalizeDocNumber(value);
    if (!v) {
      if (required) return `${label}: поле обязательно`;
      return null;
    }
    if (v.length < min || v.length > max) return `${label}: длина должна быть ${min}–${max} символов`;
    if (re && !re.test(v)) return `${label}: неверный формат`;
    return null;
  };

  const mustDate = (s, label) => {
    if (!s) return `${label}: укажите дату`;
    const d = new Date(s);
    if (!Number.isFinite(d.getTime())) return `${label}: некорректная дата`;
    return null;
  };

  const optDateIso = (s) => {
    if (!s) return null;
    const d = new Date(s);
    if (!Number.isFinite(d.getTime())) return null;
    return d.toISOString();
  };

  const isExpiredOrExpiringSoon = (isoOrDate) => {
    if (!isoOrDate) return false;
    const d = new Date(isoOrDate);
    if (!Number.isFinite(d.getTime())) return false;
    const now = new Date();
    const days = Math.ceil((d - now) / 86400000);
    return days <= 5; // просрочен или истекает в ближайшие 5 дней
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!Array.isArray(brigades) || brigades.length === 0) {
      toast.error('Сначала создайте хотя бы одну бригаду');
      return;
    }
    try {
      const citizenship = String(formData.citizenship || '').trim();
      if (!citizenship) {
        toast.error('Укажите гражданство');
        return;
      }
      if (citizenship.length > 128) {
        toast.error('Гражданство: не более 128 символов');
        return;
      }
      const errors = [
        validateDoc(formData.passport_number, {
          required: true,
          label: 'Номер паспорта',
          re: /^[0-9A-Za-zА-Яа-я\s-]+$/,
          min: 6,
          max: 20,
        }),
        validateDoc(formData.migration_card_number, {
          required: false,
          label: 'Номер миграционной карты',
          re: /^[0-9A-Za-zА-Яа-я\s-]+$/,
          min: 6,
          max: 30,
        }),
        validateDoc(formData.work_patent_number, {
          required: false,
          label: 'Номер патента',
          re: /^[0-9A-Za-zА-Яа-я\s-]+$/,
          min: 6,
          max: 30,
        }),
        mustDate(formData.passport_issued_date, 'Дата выдачи паспорта'),
        mustDate(formData.passport_expiry_date, 'Срок действия паспорта'),
      ].filter(Boolean);
      if (errors.length) {
        toast.error(errors[0]);
        return;
      }

      const payload = {
        ...formData,
        citizenship,
        passport_number: normalizeDocNumber(formData.passport_number),
        migration_card_number: normalizeDocNumber(formData.migration_card_number),
        work_patent_number: normalizeDocNumber(formData.work_patent_number),
        passport_issued_date: new Date(formData.passport_issued_date).toISOString(),
        passport_expiry_date: new Date(formData.passport_expiry_date).toISOString(),
        migration_card_expiry: optDateIso(formData.migration_card_expiry),
        work_patent_expiry: optDateIso(formData.work_patent_expiry),
      };

      // Без изменений в БД: блокируем на клиенте добавление мигранта с уже истекающими документами.
      if (
        isExpiredOrExpiringSoon(payload.passport_expiry_date) ||
        isExpiredOrExpiringSoon(payload.migration_card_expiry) ||
        isExpiredOrExpiringSoon(payload.work_patent_expiry)
      ) {
        toast.error('Нельзя добавить мигранта с просроченными или истекающими в ближайшие 5 дней документами');
        return;
      }
      
      await apiPost('/migrants', payload, {
        headers: getAuthHeader(),
      });
      
      toast.success('Мигрант добавлен');
      setOpen(false);
      setFormData({
        brigade_id: '',
        full_name: '',
        citizenship: '',
        passport_number: '',
        passport_issued_date: '',
        passport_expiry_date: '',
        migration_card_number: '',
        migration_card_expiry: '',
        work_patent_number: '',
        work_patent_expiry: ''
      });
      loadData();
    } catch (error) {
      console.error('Failed to create migrant:', error);
      if (error?.response?.status === 403) {
        toast.error('Только администратор может добавлять и удалять данные');
      } else {
        const detail = error?.response?.data?.detail;
        toast.error(typeof detail === 'string' ? detail : 'Ошибка добавления мигранта');
      }
    }
  };

  const handleDelete = async (migrant) => {
    if (!window.confirm(`Удалить мигранта «${migrant.full_name}»?`)) return;
    try {
      await apiDelete(`/migrants/${migrant.id}`, {
        headers: getAuthHeader(),
      });
      toast.success('Мигрант удалён');
      setOverrides((prev) => {
        const next = { ...prev };
        delete next[migrant.id];
        return next;
      });
      loadData();
    } catch (error) {
      console.error('Failed to delete migrant:', error);
      if (error?.response?.status === 403) {
        toast.error('Только администратор может удалять данные');
      } else {
        toast.error('Не удалось удалить мигранта');
      }
    }
  };

  const getBrigadeName = (brigadeId) => {
    const brigade = brigades.find(b => b.id === brigadeId);
    return brigade?.name || 'Неизвестно';
  };

  const isExpiringSoon = (date) => {
    if (!date) return false;
    const expiryDate = new Date(date);
    const now = new Date();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    return (expiryDate - now) <= thirtyDays && expiryDate > now;
  };

  const expiryTone = (date) => {
    if (!date) return 'none';
    const d = new Date(date);
    if (!Number.isFinite(d.getTime())) return 'none';
    const now = new Date();
    const days = Math.ceil((d - now) / 86400000);
    if (days < 0) return 'danger';
    if (days <= 5) return 'danger';
    if (days <= 30) return 'warn';
    return 'none';
  };

  const openEdit = (migrant) => {
    setEditingId(migrant.id);
    setEditData({
      brigade_id: migrant.brigade_id || '',
      full_name: migrant.full_name || '',
      citizenship: migrant.citizenship || '',
      passport_number: migrant.passport_number || '',
      passport_issued_date: migrant.passport_issued_date ? String(migrant.passport_issued_date).slice(0, 10) : '',
      passport_expiry_date: migrant.passport_expiry_date ? String(migrant.passport_expiry_date).slice(0, 10) : '',
      migration_card_number: migrant.migration_card_number || '',
      migration_card_expiry: migrant.migration_card_expiry ? String(migrant.migration_card_expiry).slice(0, 10) : '',
      work_patent_number: migrant.work_patent_number || '',
      work_patent_expiry: migrant.work_patent_expiry ? String(migrant.work_patent_expiry).slice(0, 10) : '',
    });
    setEditOpen(true);
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    const activeBrigades = brigades.filter((b) => b.status === 'active');
    if (!editingId) return;
    if (activeBrigades.length === 0) {
      toast.error('Сначала создайте хотя бы одну активную бригаду');
      return;
    }
    const citizenship = String(editData.citizenship || '').trim();
    if (!citizenship) {
      toast.error('Укажите гражданство');
      return;
    }
    if (citizenship.length > 128) {
      toast.error('Гражданство: не более 128 символов');
      return;
    }
    const errors = [
      validateDoc(editData.passport_number, {
        required: true,
        label: 'Номер паспорта',
        re: /^[0-9A-Za-zА-Яа-я\s-]+$/,
        min: 6,
        max: 20,
      }),
      validateDoc(editData.migration_card_number, {
        required: false,
        label: 'Номер миграционной карты',
        re: /^[0-9A-Za-zА-Яа-я\s-]+$/,
        min: 6,
        max: 30,
      }),
      validateDoc(editData.work_patent_number, {
        required: false,
        label: 'Номер патента',
        re: /^[0-9A-Za-zА-Яа-я\s-]+$/,
        min: 6,
        max: 30,
      }),
      mustDate(editData.passport_issued_date, 'Дата выдачи паспорта'),
      mustDate(editData.passport_expiry_date, 'Срок действия паспорта'),
    ].filter(Boolean);
    if (errors.length) {
      toast.error(errors[0]);
      return;
    }

    const payload = {
      brigade_id: editData.brigade_id,
      full_name: String(editData.full_name || '').trim(),
      citizenship,
      passport_number: normalizeDocNumber(editData.passport_number),
      passport_issued_date: new Date(editData.passport_issued_date).toISOString(),
      passport_expiry_date: new Date(editData.passport_expiry_date).toISOString(),
      migration_card_number: normalizeDocNumber(editData.migration_card_number),
      migration_card_expiry: optDateIso(editData.migration_card_expiry),
      work_patent_number: normalizeDocNumber(editData.work_patent_number),
      work_patent_expiry: optDateIso(editData.work_patent_expiry),
    };

    if (
      isExpiredOrExpiringSoon(payload.passport_expiry_date) ||
      isExpiredOrExpiringSoon(payload.migration_card_expiry) ||
      isExpiredOrExpiringSoon(payload.work_patent_expiry)
    ) {
      toast.error('Нельзя сохранить мигранта с просроченными или истекающими в ближайшие 5 дней документами');
      return;
    }

    setOverrides((prev) => ({ ...prev, [editingId]: payload }));
    setEditOpen(false);
    toast.success('Изменения мигранта сохранены (локально)');
  };

  if (!authLoading && hideMigrantSection) {
    return <Navigate to="/dashboard" replace />;
  }

  if (loading) {
    return <div className="flex items-center justify-center h-96">Загрузка...</div>;
  }

  return (
    <div data-testid="migrants-page">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight text-foreground mb-2">
            Мигранты
          </h1>
          <p className="text-sm text-muted-foreground">Паспорта, миграционный учёт, патенты</p>
        </div>
        {canEditMigrant && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              data-testid="add-migrant-button"
              className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
              disabled={brigades.filter((b) => b.status === 'active').length === 0}
            >
              <Plus className="w-4 h-4 mr-2" />
              Добавить мигранта
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Новый мигрант</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="brigade_id">Бригада</Label>
                <Select value={formData.brigade_id} onValueChange={(value) => setFormData({ ...formData, brigade_id: value })}>
                  <SelectTrigger data-testid="migrant-brigade-select">
                    <SelectValue placeholder="Выберите бригаду" />
                  </SelectTrigger>
                  <SelectContent>
                    {brigades.filter(b => b.status === 'active').length === 0 ? (
                      <SelectItem value="__empty__" disabled>Нет активных бригад</SelectItem>
                    ) : (
                      brigades.filter(b => b.status === 'active').map((brigade) => (
                        <SelectItem key={brigade.id} value={brigade.id}>
                          {brigade.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="full_name">ФИО</Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  required
                  data-testid="migrant-name-input"
                  placeholder="Иванов Иван Иванович"
                />
              </div>
              <div>
                <Label htmlFor="citizenship">Гражданство</Label>
                <Input
                  id="citizenship"
                  value={formData.citizenship}
                  onChange={(e) => setFormData({ ...formData, citizenship: e.target.value })}
                  required
                  data-testid="migrant-citizenship-input"
                  placeholder="Например: Узбекистан"
                  maxLength={128}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="passport_number">Номер паспорта</Label>
                  <Input
                    id="passport_number"
                    value={formData.passport_number}
                    onChange={(e) => setFormData({ ...formData, passport_number: e.target.value })}
                    required
                    data-testid="migrant-passport-input"
                    inputMode="text"
                    placeholder="12 34 567890"
                  />
                </div>
                <div>
                  <Label htmlFor="passport_issued_date">Дата выдачи паспорта</Label>
                  <Input
                    id="passport_issued_date"
                    type="date"
                    value={formData.passport_issued_date}
                    onChange={(e) => setFormData({ ...formData, passport_issued_date: e.target.value })}
                    required
                    data-testid="migrant-passport-issued-input"
                  />
                </div>
                <div>
                  <Label htmlFor="passport_expiry_date">Срок действия паспорта</Label>
                  <Input
                    id="passport_expiry_date"
                    type="date"
                    value={formData.passport_expiry_date}
                    onChange={(e) => setFormData({ ...formData, passport_expiry_date: e.target.value })}
                    required
                    data-testid="migrant-passport-expiry-input"
                  />
                </div>
                <div>
                  <Label htmlFor="migration_card_number">Номер миграционной карты</Label>
                  <Input
                    id="migration_card_number"
                    value={formData.migration_card_number}
                    onChange={(e) => setFormData({ ...formData, migration_card_number: e.target.value })}
                    data-testid="migrant-migration-card-input"
                    inputMode="text"
                    placeholder="серия/номер"
                  />
                </div>
                <div>
                  <Label htmlFor="migration_card_expiry">Срок миграционной карты</Label>
                  <Input
                    id="migration_card_expiry"
                    type="date"
                    value={formData.migration_card_expiry}
                    onChange={(e) => setFormData({ ...formData, migration_card_expiry: e.target.value })}
                    data-testid="migrant-migration-expiry-input"
                  />
                </div>
                <div>
                  <Label htmlFor="work_patent_number">Номер патента</Label>
                  <Input
                    id="work_patent_number"
                    value={formData.work_patent_number}
                    onChange={(e) => setFormData({ ...formData, work_patent_number: e.target.value })}
                    data-testid="migrant-patent-input"
                    inputMode="text"
                    placeholder="серия/номер"
                  />
                </div>
                <div>
                  <Label htmlFor="work_patent_expiry">Срок патента</Label>
                  <Input
                    id="work_patent_expiry"
                    type="date"
                    value={formData.work_patent_expiry}
                    onChange={(e) => setFormData({ ...formData, work_patent_expiry: e.target.value })}
                    data-testid="migrant-patent-expiry-input"
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" data-testid="migrant-submit-button">
                Добавить мигранта
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        )}
        {canEditMigrant && (
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Редактировать мигранта</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="edit_brigade_id">Бригада</Label>
                  <Select value={editData.brigade_id} onValueChange={(value) => setEditData({ ...editData, brigade_id: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите бригаду" />
                    </SelectTrigger>
                    <SelectContent>
                      {brigades.filter(b => b.status === 'active').map((brigade) => (
                        <SelectItem key={brigade.id} value={brigade.id}>{brigade.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit_full_name">ФИО</Label>
                  <Input id="edit_full_name" value={editData.full_name} onChange={(e) => setEditData({ ...editData, full_name: e.target.value })} required />
                </div>
                <div>
                  <Label htmlFor="edit_citizenship">Гражданство</Label>
                  <Input
                    id="edit_citizenship"
                    value={editData.citizenship}
                    onChange={(e) => setEditData({ ...editData, citizenship: e.target.value })}
                    required
                    maxLength={128}
                    placeholder="Например: Узбекистан"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit_passport_number">Номер паспорта</Label>
                    <Input id="edit_passport_number" value={editData.passport_number} onChange={(e) => setEditData({ ...editData, passport_number: e.target.value })} required />
                  </div>
                  <div>
                    <Label htmlFor="edit_passport_issued_date">Дата выдачи паспорта</Label>
                    <Input id="edit_passport_issued_date" type="date" value={editData.passport_issued_date} onChange={(e) => setEditData({ ...editData, passport_issued_date: e.target.value })} required />
                  </div>
                  <div>
                    <Label htmlFor="edit_passport_expiry_date">Срок действия паспорта</Label>
                    <Input id="edit_passport_expiry_date" type="date" value={editData.passport_expiry_date} onChange={(e) => setEditData({ ...editData, passport_expiry_date: e.target.value })} required />
                  </div>
                  <div>
                    <Label htmlFor="edit_migration_card_number">Номер миграционной карты</Label>
                    <Input id="edit_migration_card_number" value={editData.migration_card_number} onChange={(e) => setEditData({ ...editData, migration_card_number: e.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor="edit_migration_card_expiry">Срок миграционной карты</Label>
                    <Input id="edit_migration_card_expiry" type="date" value={editData.migration_card_expiry} onChange={(e) => setEditData({ ...editData, migration_card_expiry: e.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor="edit_work_patent_number">Номер патента</Label>
                    <Input id="edit_work_patent_number" value={editData.work_patent_number} onChange={(e) => setEditData({ ...editData, work_patent_number: e.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor="edit_work_patent_expiry">Срок патента</Label>
                    <Input id="edit_work_patent_expiry" type="date" value={editData.work_patent_expiry} onChange={(e) => setEditData({ ...editData, work_patent_expiry: e.target.value })} />
                  </div>
                </div>
                <Button type="submit" className="w-full">Сохранить</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="rounded-md border border-slate-200 overflow-hidden bg-white">
        <table className="w-full">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold tracking-wider h-10">
            <tr>
              <th className="text-left px-4 py-3">ФИО</th>
              <th className="text-left px-4 py-3">Гражданство</th>
              <th className="text-left px-4 py-3">Бригада</th>
              <th className="text-left px-4 py-3">Паспорт</th>
              <th className="text-left px-4 py-3">Срок паспорта</th>
              <th className="text-left px-4 py-3">Патент</th>
              <th className="text-left px-4 py-3">Срок патента</th>
              <th className="text-center px-2 py-3 w-14 text-slate-500">Бланк</th>
              {canEditMigrant && <th className="text-right px-4 py-3 w-28"> </th>}
            </tr>
          </thead>
          <tbody>
            {effectiveMigrants.map((migrant) => (
              <tr
                key={migrant.id}
                data-testid={`migrant-row-${migrant.id}`}
                className="hover:bg-slate-50/50 transition-colors border-b border-slate-100 last:border-0"
              >
                <td className="px-4 py-3 text-sm font-medium text-slate-700">{migrant.full_name}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{migrant.citizenship || '—'}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{getBrigadeName(migrant.brigade_id)}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{migrant.passport_number}</td>
                <td className="px-4 py-3 text-sm text-slate-600">
                  <div className="flex items-center gap-2">
                    <span className={expiryTone(migrant.passport_expiry_date) === 'danger' ? 'text-rose-700 font-semibold' : ''}>
                      {new Date(migrant.passport_expiry_date).toLocaleDateString('ru-RU')}
                    </span>
                    {expiryTone(migrant.passport_expiry_date) !== 'none' && (
                      <AlertCircle
                        className={`w-4 h-4 ${
                          expiryTone(migrant.passport_expiry_date) === 'danger' ? 'text-rose-600' : 'text-amber-600'
                        }`}
                      />
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">{migrant.work_patent_number || '-'}</td>
                <td className="px-4 py-3 text-sm text-slate-600">
                  {migrant.work_patent_expiry ? (
                    <div className="flex items-center gap-2">
                      <span className={expiryTone(migrant.work_patent_expiry) === 'danger' ? 'text-rose-700 font-semibold' : ''}>
                        {new Date(migrant.work_patent_expiry).toLocaleDateString('ru-RU')}
                      </span>
                      {expiryTone(migrant.work_patent_expiry) !== 'none' && (
                        <AlertCircle
                          className={`w-4 h-4 ${
                            expiryTone(migrant.work_patent_expiry) === 'danger' ? 'text-rose-600' : 'text-amber-600'
                          }`}
                        />
                      )}
                    </div>
                  ) : '-'}
                </td>
                <td className="px-2 py-3 text-center">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 text-slate-600 border-slate-200 hover:bg-primary/10 hover:text-primary hover:border-primary/30"
                    onClick={() => downloadRegistrationFormOne(migrant)}
                    title="Скачать бланк регистрации временного пребывания (только этот мигрант)"
                    aria-label="Бланк регистрации"
                    data-testid={`migrant-regform-${migrant.id}`}
                  >
                    <FileText className="w-4 h-4" />
                  </Button>
                </td>
                {canEditMigrant && (
                  <td className="px-4 py-3 text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-500 hover:text-primary mr-1"
                      onClick={() => openEdit(migrant)}
                      aria-label="Редактировать мигранта"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-500 hover:text-destructive"
                      onClick={() => handleDelete(migrant)}
                      aria-label="Удалить мигранта"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {migrants.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          <UserCheck className="w-12 h-12 mx-auto mb-4 text-slate-300" />
          <p>Мигрантов пока нет</p>
          <p className="text-sm">Добавьте первого мигранта для начала работы</p>
        </div>
      )}
    </div>
  );
};

export default Migrants;
