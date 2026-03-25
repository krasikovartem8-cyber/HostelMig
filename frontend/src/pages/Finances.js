import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiGet, apiPost, apiDelete } from '../lib/hostelClient';
import { Plus, DollarSign, TrendingUp, TrendingDown, Trash2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';

const Finances = () => {
  const { getAuthHeader, isAdmin, isAccountant } = useAuth();
  const canEdit = isAdmin || isAccountant;
  const [records, setRecords] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    company_id: '',
    type: 'invoice',
    amount: '',
    description: '',
    status: 'pending'
  });

  const loadData = useCallback(async () => {
    try {
      const [recordsRes, companiesRes] = await Promise.all([
        apiGet('/finances', { headers: getAuthHeader() }),
        apiGet('/companies', { headers: getAuthHeader() }),
      ]);
      setRecords(recordsRes.data);
      setCompanies(companiesRes.data);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (companies.length === 0) {
      toast.error('Сначала добавьте хотя бы одну компанию');
      return;
    }
    try {
      const payload = {
        ...formData,
        amount: parseFloat(formData.amount)
      };
      
      await apiPost('/finances', payload, {
        headers: getAuthHeader(),
      });
      
      toast.success('Запись добавлена');
      setOpen(false);
      setFormData({
        company_id: '',
        type: 'invoice',
        amount: '',
        description: '',
        status: 'pending'
      });
      loadData();
    } catch (error) {
      console.error('Failed to create record:', error);
      const detail = error?.response?.data?.detail;
      if (error?.response?.status === 403) {
        toast.error('Только администратор или бухгалтер может добавлять и удалять данные');
      } else if (typeof detail === 'string') {
        toast.error(detail);
      } else {
        toast.error('Ошибка создания записи');
      }
    }
  };

  const handleDelete = async (record) => {
    if (!window.confirm('Удалить эту финансовую запись?')) return;
    try {
      await apiDelete(`/finances/${record.id}`, {
        headers: getAuthHeader(),
      });
      toast.success('Запись удалена');
      loadData();
    } catch (error) {
      console.error('Failed to delete record:', error);
      if (error?.response?.status === 403) {
        toast.error('Только администратор или бухгалтер может удалять данные');
      } else {
        toast.error('Не удалось удалить запись');
      }
    }
  };

  const getCompanyName = (companyId) => {
    const company = companies.find(c => c.id === companyId);
    return company?.name || 'Неизвестно';
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: 'bg-amber-50 text-amber-700 border-amber-200',
      paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      overdue: 'bg-rose-50 text-rose-700 border-rose-200'
    };
    const labels = {
      pending: 'Ожидает',
      paid: 'Оплачено',
      overdue: 'Просрочено'
    };
    return (
      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold border ${badges[status]}`}>
        {labels[status]}
      </span>
    );
  };

  if (loading) {
    return <div className="flex items-center justify-center h-96">Загрузка...</div>;
  }

  const totalRevenue = records.filter((r) => r.status === 'paid').reduce((sum, r) => sum + r.amount, 0);
  const totalPending = records.filter(r => r.status === 'pending').reduce((sum, r) => sum + r.amount, 0);

  return (
    <div data-testid="finances-page">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight text-foreground mb-2">
            Финансы
          </h1>
          <p className="text-sm text-muted-foreground">Счета, оплаты, статусы.</p>
        </div>
        {canEdit && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              data-testid="add-finance-button"
              className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
              disabled={companies.length === 0}
            >
              <Plus className="w-4 h-4 mr-2" />
              Добавить запись
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Новая финансовая запись</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="company_id">Компания</Label>
                <Select value={formData.company_id} onValueChange={(value) => setFormData({ ...formData, company_id: value })}>
                  <SelectTrigger data-testid="finance-company-select">
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
                <Label htmlFor="type">Тип</Label>
                <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                  <SelectTrigger data-testid="finance-type-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="invoice">Счет</SelectItem>
                    <SelectItem value="payment">Платеж</SelectItem>
                    <SelectItem value="debt">Задолженность</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="amount">Сумма (₽)</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  required
                  data-testid="finance-amount-input"
                />
              </div>
              <div>
                <Label htmlFor="description">Описание</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                  data-testid="finance-description-input"
                />
              </div>
              <div>
                <Label htmlFor="status">Статус</Label>
                <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                  <SelectTrigger data-testid="finance-status-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Ожидает</SelectItem>
                    <SelectItem value="paid">Оплачено</SelectItem>
                    <SelectItem value="overdue">Просрочено</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" data-testid="finance-submit-button">
                Создать запись
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white border border-slate-200 shadow-sm rounded-lg p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
              <TrendingUp className="w-6 h-6 text-emerald-600" />
            </div>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-1">Общая выручка</p>
            <h3 className="text-3xl font-bold text-slate-900">₽{totalRevenue.toLocaleString()}</h3>
            <p className="text-xs text-slate-500 mt-2">Только статус «Оплачено»</p>
          </div>
        </div>
        <div className="bg-white border border-slate-200 shadow-sm rounded-lg p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
              <TrendingDown className="w-6 h-6 text-amber-600" />
            </div>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-1">Ожидает оплаты</p>
            <h3 className="text-3xl font-bold text-slate-900">₽{totalPending.toLocaleString()}</h3>
          </div>
        </div>
      </div>

      <div className="rounded-md border border-slate-200 overflow-hidden bg-white">
        <table className="w-full">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold tracking-wider h-10">
            <tr>
              <th className="text-left px-4 py-3">Компания</th>
              <th className="text-left px-4 py-3">Тип</th>
              <th className="text-left px-4 py-3">Описание</th>
              <th className="text-left px-4 py-3">Сумма</th>
              <th className="text-left px-4 py-3">Статус</th>
              <th className="text-left px-4 py-3">Дата</th>
              {canEdit && <th className="text-right px-4 py-3 w-14"> </th>}
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr
                key={record.id}
                data-testid={`finance-row-${record.id}`}
                className="hover:bg-slate-50/50 transition-colors border-b border-slate-100 last:border-0"
              >
                <td className="px-4 py-3 text-sm font-medium text-slate-700">{getCompanyName(record.company_id)}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{record.type === 'invoice' ? 'Счет' : record.type === 'payment' ? 'Платеж' : 'Задолженность'}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{record.description}</td>
                <td className="px-4 py-3 text-sm font-semibold text-slate-900">₽{record.amount.toLocaleString()}</td>
                <td className="px-4 py-3">{getStatusBadge(record.status)}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{new Date(record.date).toLocaleDateString('ru-RU')}</td>
                {canEdit && (
                  <td className="px-4 py-3 text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-500 hover:text-destructive"
                      onClick={() => handleDelete(record)}
                      aria-label="Удалить запись"
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

      {records.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          <DollarSign className="w-12 h-12 mx-auto mb-4 text-slate-300" />
          <p>Финансовых записей пока нет</p>
          <p className="text-sm">Добавьте первую запись для начала работы</p>
        </div>
      )}
    </div>
  );
};

export default Finances;
