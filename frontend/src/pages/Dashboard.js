import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiGet } from '../lib/hostelClient';
import {
  Building2,
  Users,
  UserCheck,
  Home,
  AlertCircle,
  DollarSign,
  ChevronRight,
} from 'lucide-react';

const StatCard = ({ icon: Icon, label, value, sublabel, trend, tone = 'default' }) => {
  const toneIcon = {
    default: 'bg-primary/10 text-primary border-primary/20',
    success: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/25',
    warn: 'bg-amber-500/10 text-amber-800 border-amber-500/25',
    danger: 'bg-rose-500/10 text-rose-700 border-rose-500/25',
  };

  return (
    <div
      className="bg-card border border-border/80 shadow-sm rounded-2xl p-6 hover:border-primary/25 hover:shadow-md transition-all duration-200"
      data-testid={`stat-card-${label}`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-xl border ${toneIcon[tone]}`}>
          <Icon className="w-6 h-6" />
        </div>
        {trend && <div className="text-xs font-semibold text-emerald-700">{trend}</div>}
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
          {label}
        </p>
        <h3 className="font-display text-3xl font-semibold text-foreground mb-1">{value}</h3>
        {sublabel && <p className="text-sm text-muted-foreground">{sublabel}</p>}
      </div>
    </div>
  );
};

const KIND_ICON = {
  company: Building2,
  room: Home,
  brigade: Users,
  migrant: UserCheck,
  finance: DollarSign,
};

const KIND_LINK = {
  company: '/companies',
  room: '/rooms',
  brigade: '/brigades',
  migrant: '/migrants',
  finance: '/finances',
};

function formatActivityTime(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return String(iso);
  }
}

const Dashboard = () => {
  const { getAuthHeader, isAdmin, isAccountant, isMigrationOfficer } = useAuth();
  const [stats, setStats] = useState(null);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    try {
      const h = { headers: getAuthHeader() };
      const [statsRes, actRes] = await Promise.all([
        apiGet('/dashboard/stats', h),
        apiGet('/dashboard/activity', h),
      ]);
      setStats(statsRes.data);
      setActivity(Array.isArray(actRes.data) ? actRes.data : []);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
      setActivity([]);
    } finally {
      setLoading(false);
    }
  }, [getAuthHeader]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="h-9 w-9 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span className="text-sm">Загружаем показатели…</span>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="dashboard-page">
      <div className="mb-10">
        <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight text-foreground mb-2">
          Панель управления
        </h1>
        <p className="text-muted-foreground max-w-2xl">
          Сводка по компаниям, заселению и деньгам — в одном экране, без переключения между
          вкладками.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          icon={Building2}
          label="Компании"
          value={stats?.total_companies || 0}
          sublabel="Активных клиентов"
          tone="default"
        />
        <StatCard
          icon={Users}
          label="Бригады"
          value={stats?.total_brigades || 0}
          sublabel="Размещено"
          tone="success"
        />
        <StatCard
          icon={UserCheck}
          label="Мигранты"
          value={stats?.total_migrants || 0}
          sublabel="Проживает"
          tone="default"
        />
        <StatCard
          icon={Home}
          label="Комнаты"
          value={stats?.total_rooms || 0}
          sublabel="Доступно"
          tone="warn"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-3 gap-6">
        <StatCard
          icon={DollarSign}
          label="Выручка"
          value={`₽${stats?.total_revenue?.toLocaleString() || 0}`}
          sublabel="Общая выручка"
          tone="success"
        />
        <StatCard
          icon={AlertCircle}
          label="Ожидает оплаты"
          value={`₽${stats?.pending_payments?.toLocaleString() || 0}`}
          sublabel="Дебиторская задолженность"
          tone="warn"
        />
        <StatCard
          icon={AlertCircle}
          label="Истекают документы"
          value={stats?.expiring_documents || 0}
          sublabel="В течение 5 дней"
          tone="danger"
        />
      </div>

      <div className="mt-12">
        <div className="bg-card border border-border/80 shadow-sm rounded-2xl p-6 md:p-8">
          <h3 className="font-display text-xl font-semibold text-foreground mb-1">
            Недавняя активность
          </h3>
          <p className="text-xs text-muted-foreground mb-4">
            По дате создания записей (компании, комнаты, бригады, мигранты, финансы).
          </p>
          {activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {isAdmin
                ? 'Пока нет событий — добавьте компанию, комнату, бригаду или финансовую запись.'
                : 'Пока нет отображаемых событий.'}
            </p>
          ) : (
            <ul className="space-y-0 divide-y divide-border/60" data-testid="activity-list">
              {activity.map((item, idx) => {
                if (!isAdmin && !isMigrationOfficer && item.kind === 'migrant') return null;
                const Icon = KIND_ICON[item.kind] || Building2;
                const to = KIND_LINK[item.kind] || '/dashboard';
                return (
                  <li key={`${item.kind}-${item.created_at}-${idx}`}>
                    <Link
                      to={to}
                      className="flex gap-3 py-3.5 -mx-2 px-2 rounded-lg hover:bg-secondary/50 transition-colors group"
                    >
                      <div className="p-2 rounded-lg bg-muted/80 border border-border/60 h-fit shrink-0 group-hover:border-primary/25">
                        <Icon className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{item.detail}</p>
                        <p className="text-[11px] text-muted-foreground/80 mt-1 tabular-nums">
                          {formatActivityTime(item.created_at)}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
