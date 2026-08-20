import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiGet, apiPost, apiDelete, apiPut } from '../lib/hostelClient';
import { Plus, Home, Trash2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';

const BLOCKED_ROOM_STATUSES = new Set(['maintenance', 'dirty', 'cleaning', 'quarantine']);
const NO_ROOM = '__none__';
const BRIGADE_MOVES_KEY = 'brigade_room_moves_v1';
const ROOM_STATUS_LABELS = {
  available: 'Доступна',
  occupied: 'Занята',
  maintenance: 'Обслуживание',
  dirty: 'Загрязнена',
  cleaning: 'На чистке',
  quarantine: 'На карантине',
};

const Rooms = () => {
  const { getAuthHeader, isAdmin } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [brigades, setBrigades] = useState([]);
  const [migrants, setMigrants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [relocateOpen, setRelocateOpen] = useState(false);
  const [pendingRoom, setPendingRoom] = useState(null);
  const [pendingStatus, setPendingStatus] = useState('');
  const [relocateTargets, setRelocateTargets] = useState({});
  const [formData, setFormData] = useState({
    room_number: '',
    floor: '',
    bed_count: ''
  });

  const loadData = useCallback(async () => {
    try {
      const h = { headers: getAuthHeader() };
      const [roomsRes, brigadesRes, migrantsRes] = await Promise.all([
        apiGet('/rooms', h),
        apiGet('/brigades', h),
        apiGet('/migrants', h).catch(() => ({ data: [] })),
      ]);
      setRooms(roomsRes.data);
      setBrigades(brigadesRes.data);
      setMigrants(migrantsRes.data);
    } catch (error) {
      console.error('Failed to load rooms:', error);
      toast.error('Ошибка загрузки комнат');
    } finally {
      setLoading(false);
    }
  }, [getAuthHeader]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        floor: parseInt(formData.floor),
        bed_count: parseInt(formData.bed_count)
      };
      
      await apiPost('/rooms', payload, {
        headers: getAuthHeader(),
      });
      
      toast.success('Комната добавлена');
      setOpen(false);
      setFormData({
        room_number: '',
        floor: '',
        bed_count: ''
      });
      loadData();
    } catch (error) {
      console.error('Failed to create room:', error);
      const detail = error?.response?.data?.detail;
      if (error?.response?.status === 403) {
        toast.error('Только администратор может добавлять и удалять данные');
      } else if (typeof detail === 'string') {
        toast.error(detail);
      } else {
        toast.error('Ошибка создания комнаты');
      }
    }
  };

  const handleDelete = async (room) => {
    if (!window.confirm(`Удалить комнату ${room.room_number}?`)) return;
    try {
      await apiDelete(`/rooms/${room.id}`, {
        headers: getAuthHeader(),
      });
      toast.success('Комната удалена');
      loadData();
    } catch (error) {
      console.error('Failed to delete room:', error);
      const detail = error?.response?.data?.detail;
      if (error?.response?.status === 403) {
        toast.error('Только администратор может удалять данные');
      } else if (typeof detail === 'string') {
        toast.error(detail);
      } else {
        toast.error('Не удалось удалить комнату');
      }
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      available: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      occupied: 'bg-blue-50 text-blue-700 border-blue-200',
      maintenance: 'bg-amber-50 text-amber-700 border-amber-200',
      dirty: 'bg-rose-50 text-rose-700 border-rose-200',
      cleaning: 'bg-cyan-50 text-cyan-700 border-cyan-200',
      quarantine: 'bg-violet-50 text-violet-700 border-violet-200',
    };
    return (
      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold border ${badges[status] || badges.available}`}>
        {ROOM_STATUS_LABELS[status] || ROOM_STATUS_LABELS.available}
      </span>
    );
  };

  const roomViewStatus = (room) => room.status || 'available';

  const roomBrigades = useMemo(() => {
    const map = {};
    for (const b of brigades) {
      const rid = b.room_id || NO_ROOM;
      if (!map[rid]) map[rid] = [];
      map[rid].push(b);
    }
    return map;
  }, [brigades]);

  const beginRelocation = (room, status) => {
    const affected = roomBrigades[room.id] || [];
    const init = {};
    affected.forEach((b) => {
      init[b.id] = NO_ROOM;
    });
    setPendingRoom(room);
    setPendingStatus(status);
    setRelocateTargets(init);
    setRelocateOpen(true);
  };

  const applyRelocation = async () => {
    if (!pendingRoom) return;
    const affected = roomBrigades[pendingRoom.id] || [];
    if (relocationOptions.length === 0) {
      toast.error('Нет доступных комнат для переселения');
      return;
    }
    const missing = affected.some((b) => !relocateTargets[b.id] || relocateTargets[b.id] === NO_ROOM);
    if (missing) {
      toast.error('Выберите новые комнаты для всех бригад');
      return;
    }
    try {
      const moveEntries = affected.map((b) => ({
        id: `${Date.now()}-${b.id}`,
        brigade_id: b.id,
        brigade_name: b.name,
        from_room_id: b.room_id || null,
        to_room_id: relocateTargets[b.id] || null,
        moved_at: new Date().toISOString(),
      }));
      await apiPut(
        `/rooms/${pendingRoom.id}/status`,
        {
          status: pendingStatus,
          relocations: affected.map((b) => ({
            brigade_id: b.id,
            to_room_id: relocateTargets[b.id],
          })),
        },
        { headers: getAuthHeader() }
      );
      try {
        const existing = JSON.parse(localStorage.getItem(BRIGADE_MOVES_KEY) || '[]');
        localStorage.setItem(BRIGADE_MOVES_KEY, JSON.stringify([...moveEntries, ...existing]));
      } catch {
        // no-op: if localStorage is unavailable, relocation still succeeds via API
      }
      setRelocateOpen(false);
      setPendingRoom(null);
      setPendingStatus('');
      setRelocateTargets({});
      await loadData();
      toast.success('Статус комнаты изменён, бригады переселены');
    } catch (error) {
      const detail = error?.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Не удалось изменить статус комнаты');
    }
  };

  const setRoomViewStatus = async (room, status) => {
    const current = roomViewStatus(room);
    if (status === current) return;
    const hasPeople = (roomBrigades[room.id] || []).length > 0;
    if (BLOCKED_ROOM_STATUSES.has(status) && hasPeople) {
      const options = rooms.filter(
        (r) => r.id !== room.id && !BLOCKED_ROOM_STATUSES.has(roomViewStatus(r)) && (r.bed_count - r.occupied_beds) > 0
      );
      if (options.length === 0) {
        toast.error('Нет доступных комнат для переселения');
        return;
      }
      beginRelocation(room, status);
      return;
    }
    try {
      await apiPut(
        `/rooms/${room.id}/status`,
        { status, relocations: [] },
        { headers: getAuthHeader() }
      );
      await loadData();
      toast.success('Статус комнаты сохранен');
    } catch (error) {
      const detail = error?.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Не удалось изменить статус комнаты');
    }
  };

  const getRoomNumber = (roomId) => {
    const room = rooms.find((r) => r.id === roomId);
    return room ? String(room.room_number) : 'Не назначена';
  };

  const relocationOptions = useMemo(
    () =>
      rooms.filter(
        (r) =>
          (!pendingRoom || r.id !== pendingRoom.id) &&
          !BLOCKED_ROOM_STATUSES.has(roomViewStatus(r)) &&
          (r.bed_count - r.occupied_beds) > 0
      ),
    [rooms, pendingRoom]
  );

  if (loading) {
    return <div className="flex items-center justify-center h-96">Загрузка...</div>;
  }

  return (
    <div data-testid="rooms-page">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight text-foreground mb-2">
            Комнаты
          </h1>
          <p className="text-sm text-muted-foreground">Номера, этажи, койко-места</p>
        </div>
        {isAdmin && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="add-room-button" className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm">
              <Plus className="w-4 h-4 mr-2" />
              Добавить комнату
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Новая комната</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="room_number">Номер комнаты</Label>
                <Input
                  id="room_number"
                  value={formData.room_number}
                  onChange={(e) => setFormData({ ...formData, room_number: e.target.value })}
                  required
                  data-testid="room-number-input"
                  placeholder="101"
                />
              </div>
              <div>
                <Label htmlFor="floor">Этаж</Label>
                <Input
                  id="floor"
                  type="number"
                  value={formData.floor}
                  onChange={(e) => setFormData({ ...formData, floor: e.target.value })}
                  required
                  data-testid="room-floor-input"
                />
              </div>
              <div>
                <Label htmlFor="bed_count">Количество койко-мест</Label>
                <Input
                  id="bed_count"
                  type="number"
                  value={formData.bed_count}
                  onChange={(e) => setFormData({ ...formData, bed_count: e.target.value })}
                  required
                  data-testid="room-beds-input"
                />
              </div>
              <Button type="submit" className="w-full" data-testid="room-submit-button">
                Создать комнату
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {rooms.map((room) => (
          <div
            key={room.id}
            data-testid={`room-card-${room.id}`}
            className="bg-white border border-slate-200 shadow-sm rounded-lg p-6 hover:border-primary/20 transition-colors duration-200"
          >
            <div className="flex items-start justify-between mb-4 gap-2">
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                <Home className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {getStatusBadge(roomViewStatus(room))}
                {isAdmin && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-slate-500 hover:text-destructive"
                    onClick={() => handleDelete(room)}
                    aria-label="Удалить комнату"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-2">Комната {room.room_number}</h3>
            <div className="space-y-2 text-sm text-slate-600">
              <p>Этаж: {room.floor}</p>
              <p>Койко-мест: {room.bed_count}</p>
              <p>Занято: {room.occupied_beds}</p>
              <p>Свободно: {room.bed_count - room.occupied_beds}</p>
              {isAdmin && (
                <div className="pt-1">
                  <label className="text-xs text-slate-500">Статус комнаты</label>
                  <select
                    className="mt-1 w-full h-9 border border-slate-200 rounded-md px-2 text-sm"
                    value={roomViewStatus(room)}
                    onChange={(e) => setRoomViewStatus(room, e.target.value)}
                  >
                    <option value="available">Доступна</option>
                    <option value="occupied">Занята</option>
                    <option value="maintenance">Обслуживание</option>
                    <option value="dirty">Загрязнена</option>
                    <option value="cleaning">На чистке</option>
                    <option value="quarantine">На карантине</option>
                  </select>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {rooms.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          <Home className="w-12 h-12 mx-auto mb-4 text-slate-300" />
          <p>Комнат пока нет</p>
          <p className="text-sm">Добавьте первую комнату для начала работы</p>
        </div>
      )}

      <Dialog open={relocateOpen} onOpenChange={setRelocateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Переселение при смене статуса комнаты</DialogTitle>
          </DialogHeader>
          {!pendingRoom ? null : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Комната {pendingRoom.room_number} переводится в статус "{ROOM_STATUS_LABELS[pendingStatus] || pendingStatus}". Выберите новые комнаты для бригад:
              </p>
              {relocationOptions.length === 0 && (
                <p className="text-sm text-rose-600 font-medium">Нет доступных комнат для переселения</p>
              )}
              {(roomBrigades[pendingRoom.id] || []).map((b) => {
                const people = migrants.filter((m) => m.brigade_id === b.id);
                return (
                  <div key={b.id} className="border rounded-lg p-3">
                    <p className="text-sm font-medium">{b.name}</p>
                    <p className="text-xs text-muted-foreground mb-2">
                      Люди:{' '}
                      {people.length
                        ? people
                            .map((m) => (m.citizenship ? `${m.full_name} (${m.citizenship})` : m.full_name))
                            .join(', ')
                        : 'нет данных'}
                    </p>
                    <select
                      className="w-full h-9 border border-slate-200 rounded-md px-2 text-sm"
                      value={relocateTargets[b.id] || NO_ROOM}
                      onChange={(e) => setRelocateTargets((prev) => ({ ...prev, [b.id]: e.target.value }))}
                    >
                      <option value={NO_ROOM}>Выберите комнату</option>
                      {relocationOptions.map((r) => (
                          <option key={r.id} value={r.id}>
                            Комната {r.room_number} ({getRoomNumber(r.id)})
                          </option>
                      ))}
                    </select>
                  </div>
                );
              })}
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setRelocateOpen(false)}>
                  Отмена
                </Button>
                <Button onClick={applyRelocation} disabled={relocationOptions.length === 0}>
                  Сохранить переселение
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Rooms;
