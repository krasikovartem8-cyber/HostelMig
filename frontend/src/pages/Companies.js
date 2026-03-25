import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiGet, apiPost, apiDelete, apiPut } from '../lib/hostelClient';
import { Plus, Building2, Phone, Mail, Calendar, Trash2, Pencil, Paperclip } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';

const Companies = () => {
  const { getAuthHeader, isAdmin, isAccountant } = useAuth();
  const canEdit = isAdmin || isAccountant;
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingCompanyId, setEditingCompanyId] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    inn: '',
    kpp: '',
    legal_address: '',
    contact_person: '',
    contact_phone: '',
    contact_email: '',
    tariff_per_day: '',
    contract_number: '',
    contract_date: ''
  });
  const [editFormData, setEditFormData] = useState({
    name: '',
    inn: '',
    kpp: '',
    legal_address: '',
    contact_person: '',
    contact_phone: '',
    contact_email: '',
    tariff_per_day: '',
    contract_number: '',
    contract_date: ''
  });
  const [contractFiles, setContractFiles] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('company_contract_files_local_v1') || '{}');
    } catch {
      return {};
    }
  });

  const getApiErrorMessage = (error, fallback) => {
    const detail = error?.response?.data?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0];
      if (typeof first === 'string') return first;
      if (first && typeof first === 'object') {
        if (typeof first.msg === 'string' && first.msg) return first.msg;
        if (Array.isArray(first.loc) && first.loc.length) {
          return `Поле ${String(first.loc[first.loc.length - 1])}: некорректное значение`;
        }
      }
    }
    return fallback;
  };

  const loadCompanies = useCallback(async () => {
    try {
      const response = await apiGet('/companies', {
        headers: getAuthHeader(),
      });
      setCompanies(response.data);
    } catch (error) {
      console.error('Failed to load companies:', error);
      toast.error('Ошибка загрузки компаний');
    } finally {
      setLoading(false);
    }
  }, [getAuthHeader]);

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  useEffect(() => {
    localStorage.setItem('company_contract_files_local_v1', JSON.stringify(contractFiles));
  }, [contractFiles]);

  const normalizeCompanyPayload = (source) => ({
    name: source.name.trim(),
    inn: source.inn.trim(),
    kpp: source.kpp.trim(),
    legal_address: source.legal_address.trim(),
    contact_person: source.contact_person.trim(),
    contact_phone: source.contact_phone.trim(),
    contact_email: source.contact_email.trim(),
    tariff_per_day: parseFloat(source.tariff_per_day),
    contract_number: source.contract_number.trim(),
    contract_date: source.contract_date ? new Date(source.contract_date).toISOString() : null
  });

  const validateCompanyPayload = (source) => {
    if (!source.name.trim()) return 'Название компании обязательно';
    if (!source.inn.trim()) return 'ИНН обязателен';
    if (!source.legal_address.trim()) return 'Юридический адрес обязателен';
    if (!source.contact_person.trim()) return 'Контактное лицо обязательно';
    if (!source.contact_phone.trim()) return 'Телефон обязателен';
    if (!source.contact_email.trim()) return 'Email обязателен';
    const tariff = parseFloat(source.tariff_per_day);
    if (!Number.isFinite(tariff) || tariff <= 0) return 'Тариф за день должен быть больше 0';
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const validationError = validateCompanyPayload(formData);
      if (validationError) {
        toast.error(validationError);
        return;
      }
      const payload = normalizeCompanyPayload(formData);
      
      await apiPost('/companies', payload, {
        headers: getAuthHeader(),
      });
      
      toast.success('Компания добавлена');
      setOpen(false);
      setFormData({
        name: '',
        inn: '',
        kpp: '',
        legal_address: '',
        contact_person: '',
        contact_phone: '',
        contact_email: '',
        tariff_per_day: '',
        contract_number: '',
        contract_date: ''
      });
      loadCompanies();
    } catch (error) {
      console.error('Failed to create company:', error);
      if (error?.response?.status === 403) {
        toast.error('Только администратор или бухгалтер может добавлять и удалять данные');
      } else {
        toast.error(getApiErrorMessage(error, 'Ошибка создания компании'));
      }
    }
  };

  const openEditDialog = (company) => {
    setEditingCompanyId(company.id);
    setEditFormData({
      name: company.name || '',
      inn: company.inn || '',
      kpp: company.kpp || '',
      legal_address: company.legal_address || '',
      contact_person: company.contact_person || '',
      contact_phone: company.contact_phone || '',
      contact_email: company.contact_email || '',
      tariff_per_day: company.tariff_per_day != null ? String(company.tariff_per_day) : '',
      contract_number: company.contract_number || '',
      contract_date: company.contract_date ? String(company.contract_date).slice(0, 10) : ''
    });
    setEditOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingCompanyId) return;
    try {
      const validationError = validateCompanyPayload(editFormData);
      if (validationError) {
        toast.error(validationError);
        return;
      }
      const payload = normalizeCompanyPayload(editFormData);
      await apiPut(`/companies/${editingCompanyId}`, payload, {
        headers: getAuthHeader(),
      });
      toast.success('Компания обновлена');
      setEditOpen(false);
      setEditingCompanyId('');
      loadCompanies();
    } catch (error) {
      console.error('Failed to update company:', error);
      if (error?.response?.status === 403) {
        toast.error('Только администратор или бухгалтер может редактировать данные');
      } else {
        toast.error(getApiErrorMessage(error, 'Не удалось обновить компанию'));
      }
    }
  };

  const handleDelete = async (company) => {
    if (!window.confirm(`Удалить компанию «${company.name}»?`)) return;
    try {
      await apiDelete(`/companies/${company.id}`, {
        headers: getAuthHeader(),
      });
      toast.success('Компания удалена');
      loadCompanies();
    } catch (error) {
      console.error('Failed to delete company:', error);
      if (error?.response?.status === 403) {
        toast.error('Только администратор или бухгалтер может удалять данные');
      } else {
        toast.error(getApiErrorMessage(error, 'Не удалось удалить компанию'));
      }
    }
  };

  const handleContractUpload = async (companyId, file) => {
    if (!file) return;
    const toDataUrl = (f) =>
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(f);
      });
    try {
      const dataUrl = await toDataUrl(file);
      setContractFiles((prev) => ({
        ...prev,
        [companyId]: [
          { id: `${Date.now()}-${Math.random()}`, name: file.name, uploaded_at: new Date().toISOString(), data_url: dataUrl },
          ...(prev[companyId] || []),
        ].slice(0, 5),
      }));
      toast.success('Договор загружен (локально)');
    } catch {
      toast.error('Не удалось загрузить файл договора');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-96">Загрузка...</div>;
  }

  return (
    <div data-testid="companies-page">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight text-foreground mb-2">
            Компании
          </h1>
          <p className="text-sm text-muted-foreground">Компании-клиенты и договоры</p>
        </div>
        {canEdit && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="add-company-button" className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm">
              <Plus className="w-4 h-4 mr-2" />
              Добавить компанию
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Новая компания</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="name">Название компании</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    data-testid="company-name-input"
                  />
                </div>
                <div>
                  <Label htmlFor="inn">ИНН</Label>
                  <Input
                    id="inn"
                    value={formData.inn}
                    onChange={(e) => setFormData({ ...formData, inn: e.target.value })}
                    required
                    data-testid="company-inn-input"
                  />
                </div>
                <div>
                  <Label htmlFor="kpp">КПП</Label>
                  <Input
                    id="kpp"
                    value={formData.kpp}
                    onChange={(e) => setFormData({ ...formData, kpp: e.target.value })}
                    data-testid="company-kpp-input"
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="legal_address">Юридический адрес</Label>
                  <Input
                    id="legal_address"
                    value={formData.legal_address}
                    onChange={(e) => setFormData({ ...formData, legal_address: e.target.value })}
                    required
                    data-testid="company-address-input"
                  />
                </div>
                <div>
                  <Label htmlFor="contact_person">Контактное лицо</Label>
                  <Input
                    id="contact_person"
                    value={formData.contact_person}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                    required
                    data-testid="company-contact-input"
                  />
                </div>
                <div>
                  <Label htmlFor="contact_phone">Телефон</Label>
                  <Input
                    id="contact_phone"
                    value={formData.contact_phone}
                    onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                    required
                    data-testid="company-phone-input"
                  />
                </div>
                <div>
                  <Label htmlFor="contact_email">Email</Label>
                  <Input
                    id="contact_email"
                    type="email"
                    value={formData.contact_email}
                    onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                    required
                    data-testid="company-email-input"
                  />
                </div>
                <div>
                  <Label htmlFor="tariff_per_day">Тариф за день (₽)</Label>
                  <Input
                    id="tariff_per_day"
                    type="number"
                    step="0.01"
                    value={formData.tariff_per_day}
                    onChange={(e) => setFormData({ ...formData, tariff_per_day: e.target.value })}
                    required
                    data-testid="company-tariff-input"
                  />
                </div>
                <div>
                  <Label htmlFor="contract_number">Номер договора</Label>
                  <Input
                    id="contract_number"
                    value={formData.contract_number}
                    onChange={(e) => setFormData({ ...formData, contract_number: e.target.value })}
                    data-testid="company-contract-input"
                  />
                </div>
                <div>
                  <Label htmlFor="contract_date">Дата договора</Label>
                  <Input
                    id="contract_date"
                    type="date"
                    value={formData.contract_date}
                    onChange={(e) => setFormData({ ...formData, contract_date: e.target.value })}
                    data-testid="company-date-input"
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" data-testid="company-submit-button">
                Создать компанию
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        )}
        {canEdit && (
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Редактировать компанию</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label htmlFor="edit_name">Название компании</Label>
                    <Input id="edit_name" value={editFormData.name} onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })} required />
                  </div>
                  <div>
                    <Label htmlFor="edit_inn">ИНН</Label>
                    <Input id="edit_inn" value={editFormData.inn} onChange={(e) => setEditFormData({ ...editFormData, inn: e.target.value })} required />
                  </div>
                  <div>
                    <Label htmlFor="edit_kpp">КПП</Label>
                    <Input id="edit_kpp" value={editFormData.kpp} onChange={(e) => setEditFormData({ ...editFormData, kpp: e.target.value })} />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="edit_legal_address">Юридический адрес</Label>
                    <Input id="edit_legal_address" value={editFormData.legal_address} onChange={(e) => setEditFormData({ ...editFormData, legal_address: e.target.value })} required />
                  </div>
                  <div>
                    <Label htmlFor="edit_contact_person">Контактное лицо</Label>
                    <Input id="edit_contact_person" value={editFormData.contact_person} onChange={(e) => setEditFormData({ ...editFormData, contact_person: e.target.value })} required />
                  </div>
                  <div>
                    <Label htmlFor="edit_contact_phone">Телефон</Label>
                    <Input id="edit_contact_phone" value={editFormData.contact_phone} onChange={(e) => setEditFormData({ ...editFormData, contact_phone: e.target.value })} required />
                  </div>
                  <div>
                    <Label htmlFor="edit_contact_email">Email</Label>
                    <Input id="edit_contact_email" type="email" value={editFormData.contact_email} onChange={(e) => setEditFormData({ ...editFormData, contact_email: e.target.value })} required />
                  </div>
                  <div>
                    <Label htmlFor="edit_tariff_per_day">Тариф за день (₽)</Label>
                    <Input id="edit_tariff_per_day" type="number" step="0.01" value={editFormData.tariff_per_day} onChange={(e) => setEditFormData({ ...editFormData, tariff_per_day: e.target.value })} required />
                  </div>
                  <div>
                    <Label htmlFor="edit_contract_number">Номер договора</Label>
                    <Input id="edit_contract_number" value={editFormData.contract_number} onChange={(e) => setEditFormData({ ...editFormData, contract_number: e.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor="edit_contract_date">Дата договора</Label>
                    <Input id="edit_contract_date" type="date" value={editFormData.contract_date} onChange={(e) => setEditFormData({ ...editFormData, contract_date: e.target.value })} />
                  </div>
                </div>
                <Button type="submit" className="w-full">Сохранить изменения</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {companies.map((company) => (
          <div
            key={company.id}
            data-testid={`company-card-${company.id}`}
            className="bg-white border border-slate-200 shadow-sm rounded-lg p-6 hover:border-primary/20 transition-colors duration-200"
          >
            <div className="flex items-start justify-between mb-4 gap-2">
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                <Building2 className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="rounded-full px-2.5 py-0.5 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Активна
                </div>
                {canEdit && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-slate-500 hover:text-primary"
                    onClick={() => openEditDialog(company)}
                    aria-label="Редактировать компанию"
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                )}
                {canEdit && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-slate-500 hover:text-destructive"
                    onClick={() => handleDelete(company)}
                    aria-label="Удалить компанию"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-2">{company.name}</h3>
            <div className="space-y-2 text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4" />
                <span>{company.contact_phone}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                <span className="truncate">{company.contact_email}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>Тариф: ₽{company.tariff_per_day}/день</span>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-xs text-slate-500">ИНН: {company.inn}</p>
              {company.contract_number && (
                <p className="text-xs text-slate-500">Договор: {company.contract_number}</p>
              )}
              {canEdit && (
                <div className="mt-3">
                  <label className="inline-flex items-center gap-2 text-xs text-primary cursor-pointer">
                    <Paperclip className="w-3.5 h-3.5" />
                    Подгрузить договор
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                      onChange={(e) => handleContractUpload(company.id, e.target.files?.[0])}
                    />
                  </label>
                </div>
              )}
              {(contractFiles[company.id] || []).length > 0 && (
                <div className="mt-2 space-y-1">
                  {(contractFiles[company.id] || []).map((f) => (
                    <a key={f.id} href={f.data_url} download={f.name} className="block text-xs text-blue-600 hover:underline truncate">
                      {f.name}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {companies.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          <Building2 className="w-12 h-12 mx-auto mb-4 text-slate-300" />
          <p>Компаний пока нет</p>
          <p className="text-sm">Добавьте первую компанию для начала работы</p>
        </div>
      )}
    </div>
  );
};

export default Companies;
