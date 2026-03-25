import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { User } from 'lucide-react';

const Settings = () => {
  const { user } = useAuth();

  return (
    <div data-testid="settings-page">
      <div className="mb-10">
        <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight text-foreground mb-2">
          Настройки
        </h1>
        <p className="text-muted-foreground">Профиль и параметры</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border/80 shadow-sm rounded-2xl p-6 md:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
              <User className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="font-display text-xl font-semibold text-foreground">Профиль</h3>
              <p className="text-sm text-muted-foreground">Данные учётной записи</p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
                ФИО
              </label>
              <input
                type="text"
                value={user?.full_name || ''}
                readOnly
                className="w-full h-10 px-3 bg-secondary/50 border border-border rounded-xl text-foreground"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
                Email
              </label>
              <input
                type="email"
                value={user?.email || ''}
                readOnly
                className="w-full h-10 px-3 bg-secondary/50 border border-border rounded-xl text-foreground"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
                Роль
              </label>
              <div className="flex flex-wrap gap-2">
                {user?.role?.admin ? (
                  <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold bg-primary/10 text-primary border border-primary/25">
                    Администратор
                  </span>
                ) : user?.role?.accountant ? (
                  <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold bg-emerald-500/10 text-emerald-800 border border-emerald-500/25">
                    Бухгалтер
                  </span>
                ) : user?.role?.migration_officer ? (
                  <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold bg-amber-500/10 text-amber-900 border border-amber-500/25">
                    Миграционный учёт
                  </span>
                ) : (
                  <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                    Сотрудник
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
