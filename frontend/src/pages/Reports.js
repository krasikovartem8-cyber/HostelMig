import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FileText, Download, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useAuth } from '../contexts/AuthContext';
import { apiGet } from '../lib/hostelClient';
import { Navigate } from 'react-router-dom';
import {
  buildOccupancyCsv,
  buildFinancesCsv,
  buildCompaniesBrigadesCsv,
  buildMigrantsCsv,
  buildBrigadesCsv,
  buildExpiringDocumentsCsv,
  buildFinancesPeriodCsv,
  buildTemporaryStayRegistrationHtml,
  downloadCsv,
  downloadHtml,
} from '../lib/reportExport';
import { toast } from 'sonner';

const todayStamp = () => new Date().toISOString().slice(0, 10);

const Reports = () => {
  const { getAuthHeader, isAdmin, isAccountant, isMigrationOfficer, loading: authLoading } = useAuth();
  const canUseReports = isAdmin || isAccountant || isMigrationOfficer;
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [data, setData] = useState(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const needMigrantData = isAdmin || isMigrationOfficer;
  const needFinanceData = isAdmin || isAccountant;
  const needCompanyAndRoomData = isAdmin || isAccountant;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const h = { headers: getAuthHeader() };
      const withCompaniesAndRooms = needCompanyAndRoomData || needMigrantData;
      const [brigadesRes, maybeCompaniesRes, maybeRoomsRes, maybeMigrantsRes, maybeFinancesRes] = await Promise.all([
        apiGet('/brigades', h),
        withCompaniesAndRooms ? apiGet('/companies', h) : Promise.resolve({ data: [] }),
        withCompaniesAndRooms ? apiGet('/rooms', h) : Promise.resolve({ data: [] }),
        needMigrantData ? apiGet('/migrants', h) : Promise.resolve({ data: [] }),
        needFinanceData ? apiGet('/finances', h) : Promise.resolve({ data: [] }),
      ]);

      setData({
        companies: maybeCompaniesRes.data,
        rooms: maybeRoomsRes.data,
        brigades: brigadesRes.data,
        migrants: maybeMigrantsRes.data,
        finances: maybeFinancesRes.data,
      });
    } catch (e) {
      console.error(e);
      toast.error('Не удалось загрузить данные для отчётов');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [getAuthHeader, needMigrantData, needFinanceData, needCompanyAndRoomData]);

  useEffect(() => {
    if (authLoading) return;
    if (!canUseReports) return;
    loadData();
  }, [loadData, authLoading, canUseReports]);

  const maps = useMemo(() => {
    if (!data) return null;
    return {
      companyNameById: Object.fromEntries(data.companies.map((c) => [c.id, c.name])),
      brigadeNameById: Object.fromEntries(data.brigades.map((b) => [b.id, b.name])),
      roomNumberById: Object.fromEntries(data.rooms.map((r) => [r.id, String(r.room_number)])),
    };
  }, [data]);

  const runExport = useCallback(
    (id, fn) => {
      if (!data || !maps) {
        toast.error('Данные ещё не загружены');
        return;
      }
      setBusyId(id);
      try {
        const stamp = todayStamp();
        fn(stamp);
        toast.success('Отчёт сформирован — проверьте загрузки браузера');
      } catch (err) {
        console.error(err);
        toast.error('Ошибка при формировании отчёта');
      } finally {
        setBusyId(null);
      }
    },
    [data, maps]
  );

  const reports = [
    {
      id: 1,
      name: 'Загрузка хостела',
      description: 'Комнаты, койко-места, занятость',
      onGenerate: (stamp) => {
        downloadCsv(`hostel-zagruzka-${stamp}.csv`, buildOccupancyCsv(data.rooms));
      },
    },
    {
      id: 2,
      name: 'Финансы',
      description: 'Выручка, счета, статусы оплат',
      onGenerate: (stamp) => {
        downloadCsv(
          `hostel-finansy-${stamp}.csv`,
          buildFinancesCsv(data.finances, maps.companyNameById)
        );
      },
    },
    {
      id: 3,
      name: 'Компании и бригады',
      description: 'Сводка по контрагентам и бригадам',
      onGenerate: (stamp) => {
        downloadCsv(
          `hostel-kompanii-brigady-${stamp}.csv`,
          buildCompaniesBrigadesCsv(data.companies, data.brigades)
        );
      },
    },
    {
      id: 4,
      name: 'Миграционный учёт',
      description: 'Паспорта, карты, патенты',
      onGenerate: (stamp) => {
        downloadCsv(
          `hostel-migracionnyy-uchet-${stamp}.csv`,
          buildMigrantsCsv(data.migrants, maps.brigadeNameById)
        );
      },
    },
    {
      id: 5,
      name: 'Бригады',
      description: 'Активные и выселенные, комнаты',
      onGenerate: (stamp) => {
        downloadCsv(
          `hostel-brigady-${stamp}.csv`,
          buildBrigadesCsv(data.brigades, maps.companyNameById, maps.roomNumberById)
        );
      },
    },
    {
      id: 6,
      name: 'Истекающие документы',
      description: 'Истекают в течение 5 дней и просроченные',
      onGenerate: (stamp) => {
        downloadCsv(
          `hostel-istekayushchie-dokumenty-${stamp}.csv`,
          buildExpiringDocumentsCsv(data.migrants, maps.brigadeNameById, 5)
        );
      },
    },
    {
      id: 7,
      name: 'Регистрация временного пребывания',
      description: 'Один HTML-файл со всеми бланками по списку мигрантов (печать и дозаполнение)',
      onGenerate: (stamp) => {
        const html = buildTemporaryStayRegistrationHtml(
          data.migrants,
          data.brigades,
          data.companies,
          maps.roomNumberById
        );
        downloadHtml(`hostel-registraciya-prebyvaniya-${stamp}.html`, html);
      },
    },
  ];
  const visibleReports = isAdmin
    ? reports
    : isMigrationOfficer
      ? reports.filter((r) => [4, 6, 7].includes(r.id)) // мигранты + бланки регистрации
      : isAccountant
        ? reports.filter((r) => ![4, 6, 7].includes(r.id)) // всё, кроме мигрантовых
        : [];

  const hasDataForReport = useCallback(
    (reportId) => {
      if (!data) return false;
      if (reportId === 1) return Array.isArray(data.rooms) && data.rooms.length > 0;
      if (reportId === 2) return Array.isArray(data.finances) && data.finances.length > 0;
      if (reportId === 3) return Array.isArray(data.companies) && data.companies.length > 0 && Array.isArray(data.brigades) && data.brigades.length > 0;
      if (reportId === 4) return Array.isArray(data.migrants) && data.migrants.length > 0;
      if (reportId === 5) return Array.isArray(data.brigades) && data.brigades.length > 0;
      if (reportId === 6) return Array.isArray(data.migrants) && data.migrants.length > 0;
      if (reportId === 7) return Array.isArray(data.migrants) && data.migrants.length > 0;
      return false;
    },
    [data]
  );

  const showFinancePeriod = isAdmin || isAccountant; // миграционный учёт не работает с финансами

  const handlePeriod = () => {
    if (!data || !maps) {
      toast.error('Данные ещё не загружены');
      return;
    }
    if (!dateFrom && !dateTo) {
      toast.error('Укажите хотя бы одну дату периода');
      return;
    }
    if (dateFrom && dateTo && dateFrom > dateTo) {
      toast.error('Дата начала не может быть позже даты окончания');
      return;
    }
    setBusyId('period');
    try {
      const { csv, count } = buildFinancesPeriodCsv(
        data.finances,
        maps.companyNameById,
        dateFrom,
        dateTo
      );
      downloadCsv(`hostel-finansy-period-${todayStamp()}.csv`, csv);
      toast.success(`Сформировано записей: ${count}`);
    } catch (e) {
      console.error(e);
      toast.error('Не удалось собрать отчёт');
    } finally {
      setBusyId(null);
    }
  };

  if (loading && !data) {
    return (
      <div data-testid="reports-page" className="flex items-center justify-center min-h-[40vh] gap-3 text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span>Загружаем данные…</span>
      </div>
    );
  }

  if (!authLoading && !canUseReports) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div data-testid="reports-page">
      <div className="mb-10 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight text-foreground mb-2">
            Отчёты
          </h1>
        </div>
        <Button variant="outline" className="rounded-xl shrink-0" onClick={() => loadData()} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Обновить данные
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {visibleReports.map((report) => (
          <div
            key={report.id}
            data-testid={`report-card-${report.id}`}
            className="group bg-card border border-border/80 shadow-sm rounded-2xl p-6 hover:border-primary/30 hover:shadow-md transition-all duration-200"
          >
            <div className="flex gap-4">
              <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 h-fit shrink-0">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-display text-lg font-semibold text-foreground leading-snug mb-1">
                  {report.name}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">{report.description}</p>
                <Button
                  data-testid={`download-report-${report.id}`}
                  variant="outline"
                  className="rounded-xl border-border/80 hover:bg-secondary"
                  disabled={!data || busyId === report.id || !hasDataForReport(report.id)}
                  onClick={() => {
                    if (!hasDataForReport(report.id)) {
                      toast.error('Недостаточно данных для этого отчёта');
                      return;
                    }
                    runExport(report.id, report.onGenerate);
                  }}
                >
                  {busyId === report.id ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 mr-2" />
                  )}
                  Сформировать
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showFinancePeriod && (
        <div className="mt-10 bg-card border border-border/80 shadow-sm rounded-2xl p-6 md:p-8">
          <h3 className="font-display text-xl font-semibold text-foreground mb-2">
            Произвольный период (финансы)
          </h3>
          <p className="text-sm text-muted-foreground mb-6">
            Отбор записей по полю «дата» финансовых операций. Можно указать только начало или только конец периода.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                Дата начала
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full h-11 px-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                Дата окончания
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full h-11 px-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div className="flex items-end">
              <Button
                className="w-full h-11 rounded-xl font-semibold"
                disabled={!data || busyId === 'period' || !Array.isArray(data?.finances) || data.finances.length === 0}
                onClick={handlePeriod}
              >
                {busyId === 'period' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Собрать CSV'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
