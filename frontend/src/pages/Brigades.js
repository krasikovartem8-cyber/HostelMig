import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiGet, apiPost, apiDelete } from '../lib/hostelClient';
import { Plus, Users, Calendar, MapPin, Trash2, Pencil } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';

const NO_ROOM = '__none__';
const BRIGADE_OVERRIDES_KEY = 'brigade_local_overrides_v1';
const BRIGADE_MOVES_KEY = 'brigade_room_moves_v1';

const Brigades = () => {
  const { getAuthHeader, isAdmin } = useAuth();
  const [brigades, setBrigades] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [overrides, setOverrides] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(BRIGADE_OVERRIDES_KEY) || '{}');
    } catch {
      return {};
    }
  });
  const [moves, setMoves] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(BRIGADE_MOVES_KEY) || '[]');
    } catch {
      return [];
    }
  });
  const [formData, setFormData] = useState({
    company_id: '',
    name: '',
    room_id: NO_ROOM,
    check_in_date: ''
  });
  const [editData, setEditData] = useState({
    name: '',
    room_id: NO_ROOM,
    check_in_date: ''
  });

  const loadData = useCallback(async () => {
    try {
      const [brigadesRes, companiesRes, roomsRes] = await Promise.all([
        apiGet('/brigades', { headers: getAuthHeader() }),
        apiGet('/companies', { headers: getAuthHeader() }),
        apiGet('/rooms', { headers: getAuthHeader() }),
      ]);
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
    loadData();
  }, [loadData]);

  useEffect(() => {
    localStorage.setItem(BRIGADE_OVERRIDES_KEY, JSON.stringify(overrides));
  }, [overrides]);

  useEffect(() => {
    localStorage.setItem(BRIGADE_MOVES_KEY, JSON.stringify(moves));
  }, [moves]);

  const effectiveBrigades = useMemo(
    () =>
      brigades.map((b) => {
        const ov = overrides[b.id] || {};
        return {
          ...b,
          ...ov,
          room_id: ov.room_id === NO_ROOM ? null : ov.room_id ?? b.room_id,
        };
      }),
    [brigades, overrides]
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (companies.length === 0) {
      toast.error('Сначала добавьте хотя бы одну компанию');
      return;
    }
    try {
      const payload = {
        company_id: formData.company_id,
        name: formData.name,
        check_in_date: new Date(formData.check_in_date).toISOString(),
      };
      if (formData.room_id && formData.room_id !== NO_ROOM) {
        payload.room_id = formData.room_id;
      }

      await apiPost('/brigades', payload, {
        headers: getAuthHeader(),
      });
      
      toast.success('Бригада создана');
      setOpen(false);
      setFormData({
        company_id: '',
        name: '',
        room_id: NO_ROOM,
        check_in_date: ''
      });
      loadData();
    } catch (error) {
      console.error('Failed to create brigade:', error);
      const detail = error?.response?.data?.detail;
      if (error?.response?.status === 403) {
        toast.error('Только администратор может добавлять и удалять данные');
      } else if (typeof detail === 'string') {
        toast.error(detail);
      } else {
        toast.error('Ошибка создания бригады');
      }
    }
  };

  const handleDelete = async (brigade) => {
    if (!window.confirm(`Удалить бригаду «${brigade.name}»? Будут удалены связанные мигранты.`)) return;
    try {
      await apiDelete(`/brigades/${brigade.id}`, {
        headers: getAuthHeader(),
      });
      toast.success('Бригада удалена');
      setOverrides((prev) => {
        const next = { ...prev };
        delete next[brigade.id];
        return next;
      });
      setMoves((prev) => prev.filter((m) => m.brigade_id !== brigade.id));
      loadData();
    } catch (error) {
      console.error('Failed to delete brigade:', error);
      if (error?.response?.status === 403) {
        toast.error('Только администратор может удалять данные');
      } else {
        toast.error('Не удалось удалить бригаду');
      }
    }
  };

  const getCompanyName = (companyId) => {
    const company = companies.find(c => c.id === companyId);
    return company?.name || 'Неизвестно';
  };

  const getRoomNumber = (roomId) => {
    const room = rooms.find(r => r.id === roomId);
    return room?.room_number || 'Не назначена';
  };

  const openEdit = (brigade) => {
    setEditingId(brigade.id);
    setEditData({
      name: brigade.name || '',
      room_id: brigade.room_id || NO_ROOM,
      check_in_date: brigade.check_in_date ? String(brigade.check_in_date).slice(0, 10) : '',
    });
    setEditOpen(true);
  };

  const saveEdit = (e) => {
    e.preventDefault();
    const base = effectiveBrigades.find((b) => b.id === editingId);
    if (!base) return;
    const nextRoom = editData.room_id === NO_ROOM ? null : editData.room_id;
    const prevRoom = base.room_id || null;
    setOverrides((prev) => ({
      ...prev,
      [editingId]: {
        name: editData.name.trim(),
        room_id: nextRoom,
        check_in_date: editData.check_in_date ? new Date(editData.check_in_date).toISOString() : base.check_in_date,
      },
    }));
    if (prevRoom !== nextRoom) {
      setMoves((prev) => [
        {
          id: `${Date.now()}-${Math.random()}`,
          brigade_id: editingId,
          brigade_name: editData.name.trim() || base.name,
          from_room_id: prevRoom,
          to_room_id: nextRoom,
          moved_at: new Date().toISOString(),
        },
        ...prev,
      ]);
    }
    setEditOpen(false);
    toast.success('Изменения бригады сохранены (локально)');
  };

  if (loading) {
    return <div className="flex items-center justify-center h-96">Загрузка...</div>;
  }

  return (
    <div data-testid="brigades-page">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight text-foreground mb-2">
            Бригады
          </h1>
          <p className="text-sm text-muted-foreground">Заселение бригад по комнатам</p>
        </div>
        {isAdmin && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              data-testid="add-brigade-button"
              className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
              disabled={companies.length === 0}
            >
              <Plus className="w-4 h-4 mr-2" />
              Создать бригаду
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Новая бригада</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="company_id">Компания</Label>
                <Select value={formData.company_id} onValueChange={(value) => setFormData({ ...formData, company_id: value })}>
                  <SelectTrigger data-testid="brigade-company-select">
                    <SelectValue placeholder="Выберите компанию" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.length === 0 ? (
                      <SelectItem value="__empty__" disabled>
                        Нет компаний
                      </SelectItem>
                    ) : (
                      companies.map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="name">Название бригады</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  data-testid="brigade-name-input"
                  placeholder="Бригада №1"
                />
              </div>
              <div>
                <Label htmlFor="room_id">Комната</Label>
                <Select value={formData.room_id} onValueChange={(value) => setFormData({ ...formData, room_id: value })}>
                  <SelectTrigger data-testid="brigade-room-select">
                    <SelectValue placeholder="Комната" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_ROOM}>Не назначена</SelectItem>
                    {rooms.map((room) => (
                      <SelectItem key={room.id} value={room.id}>
                        Комната {room.room_number} (Свободно: {room.bed_count - room.occupied_beds} мест)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="check_in_date">Дата заселения</Label>
                <Input
                  id="check_in_date"
                  type="date"
                  value={formData.check_in_date}
                  onChange={(e) => setFormData({ ...formData, check_in_date: e.target.value })}
                  required
                  data-testid="brigade-checkin-input"
                />
              </div>
              <Button type="submit" className="w-full" data-testid="brigade-submit-button">
                Создать бригаду
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        )}
        {isAdmin && (
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Редактировать бригаду</DialogTitle>
              </DialogHeader>
              <form onSubmit={saveEdit} className="space-y-4">
                <div>
                  <Label htmlFor="edit_name">Название бригады</Label>
                  <Input id="edit_name" value={editData.name} onChange={(e) => setEditData({ ...editData, name: e.target.value })} required />
                </div>
                <div>
                  <Label htmlFor="edit_room">Комната</Label>
                  <Select value={editData.room_id} onValueChange={(value) => setEditData({ ...editData, room_id: value })}>
                    <SelectTrigger><SelectValue placeholder="Комната" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_ROOM}>Не назначена</SelectItem>
                      {rooms.map((room) => (
                        <SelectItem key={room.id} value={room.id}>Комната {room.room_number}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit_checkin">Дата заселения</Label>
                  <Input id="edit_checkin" type="date" value={editData.check_in_date} onChange={(e) => setEditData({ ...editData, check_in_date: e.target.value })} required />
                </div>
                <Button type="submit" className="w-full">Сохранить</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {effectiveBrigades.map((brigade) => (
          <div
            key={brigade.id}
            data-testid={`brigade-card-${brigade.id}`}
            className="bg-white border border-slate-200 shadow-sm rounded-lg p-6 hover:border-primary/20 transition-colors duration-200"
          >
            <div className="flex items-start justify-between mb-4 gap-2">
              <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                <Users className="w-6 h-6 text-green-600" />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  brigade.status === 'active'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                }`}>
                  {brigade.status === 'active' ? 'Активна' : 'Выселена'}
                </div>
                {isAdmin && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-slate-500 hover:text-primary"
                    onClick={() => openEdit(brigade)}
                    aria-label="Редактировать бригаду"
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                )}
                {isAdmin && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-slate-500 hover:text-destructive"
                    onClick={() => handleDelete(brigade)}
                    aria-label="Удалить бригаду"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-2">{brigade.name}</h3>
            <div className="space-y-2 text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span>{getCompanyName(brigade.company_id)}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                <span>Комната: {getRoomNumber(brigade.room_id)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>Заселение: {new Date(brigade.check_in_date).toLocaleDateString('ru-RU')}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {brigades.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          <Users className="w-12 h-12 mx-auto mb-4 text-slate-300" />
          <p>Бригад пока нет</p>
          <p className="text-sm">Создайте первую бригаду для начала работы</p>
        </div>
      )}

      <div className="mt-10 bg-card border border-border/80 rounded-2xl p-6">
        <h3 className="font-display text-lg font-semibold text-foreground mb-3">История перемещения бригад по комнатам</h3>
        {moves.length === 0 ? (
          <p className="text-sm text-muted-foreground">Перемещений пока не было.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {moves.slice(0, 20).map((m) => (
              <li key={m.id} className="text-slate-700">
                {new Date(m.moved_at).toLocaleString('ru-RU')} - {m.brigade_name}: {getRoomNumber(m.from_room_id)} → {getRoomNumber(m.to_room_id)}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default Brigades;
