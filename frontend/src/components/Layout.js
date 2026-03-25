import React, { useMemo } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard,
  Building2,
  Users,
  UserCheck,
  DollarSign,
  Home,
  FileText,
  Settings,
  LogOut,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { BrandMark } from './BrandMark';

const Layout = ({ children }) => {
  const { user, logout, isAdmin, isAccountant, isMigrationOfficer } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = useMemo(() => {
    const all = [
      { path: '/dashboard', icon: LayoutDashboard, label: 'Панель управления' },
      { path: '/companies', icon: Building2, label: 'Компании' },
      { path: '/brigades', icon: Users, label: 'Бригады' },
      { path: '/migrants', icon: UserCheck, label: 'Мигранты' },
      { path: '/finances', icon: DollarSign, label: 'Финансы' },
      { path: '/rooms', icon: Home, label: 'Комнаты' },
      { path: '/reports', icon: FileText, label: 'Отчеты' },
      { path: '/settings', icon: Settings, label: 'Настройки' },
    ];
    // Сотруднику и бухгалтеру скрываем документы мигрантов
    if (!isAdmin && !isMigrationOfficer) {
      const filtered = all.filter((x) => x.path !== '/migrants');
      // Сотруднику также скрываем панель отчётов
      if (!isAccountant) return filtered.filter((x) => x.path !== '/reports');
      return filtered;
    }
    // Бухгалтеру скрываем отчёты по документам мигрантов, но сам раздел отчётов оставляем.
    // Миграционному учёту и администратору показываем всё, что разрешено логикой на странице.
    return all;
  }, [isAdmin, isAccountant, isMigrationOfficer]);

  const roleLabel = user?.role?.admin
    ? 'Администратор'
    : user?.role?.accountant
      ? 'Бухгалтер'
      : user?.role?.migration_officer
        ? 'Миграционный учёт'
        : 'Сотрудник';

  return (
    <div className="min-h-screen bg-app-mesh">
      <aside className="w-64 fixed h-full z-30 flex flex-col border-r border-border/80 bg-card/95 backdrop-blur-md shadow-sm">
        <div className="p-6 border-b border-border/60">
          <BrandMark />
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                data-testid={`nav-${item.label.toLowerCase()}`}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                  }`
                }
              >
                <Icon className="w-[1.125rem] h-[1.125rem] shrink-0 opacity-90" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border/60 bg-card/80 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center ring-2 ring-background">
              <span className="text-sm font-semibold text-primary">
                {user?.full_name?.charAt(0) || '·'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{user?.full_name}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>
          <Button
            onClick={handleLogout}
            data-testid="logout-button"
            variant="outline"
            className="w-full justify-center border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Выйти
          </Button>
        </div>
      </aside>

      <main className="ml-64 min-h-screen">
        <header className="sticky top-0 z-20 border-b border-border/60 bg-card/70 backdrop-blur-lg px-6 md:px-10 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {new Date().toLocaleDateString('ru-RU', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                {roleLabel}
              </span>
            </div>
          </div>
        </header>

        <div className="p-6 md:p-8 lg:p-10 max-w-[1600px] mx-auto">{children}</div>
      </main>
    </div>
  );
};

export default Layout;
