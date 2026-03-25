import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { BrandMark } from '../components/BrandMark';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await login(email, password);
      toast.success('Вход выполнен');
      navigate('/dashboard');
    } catch (error) {
      const status = error?.response?.status;
      if (status === 401) {
        toast.error('Неверный email или пароль');
      } else if (status === 403) {
        toast.error('Доступ запрещён');
      } else if (!error.response) {
        toast.error('Не удалось войти. Обновите страницу и попробуйте снова.');
      } else {
        toast.error('Ошибка сервера.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      <div className="relative hidden lg:flex lg:w-[46%] xl:w-1/2 bg-login-panel text-white flex-col justify-between p-12 xl:p-16 overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
        <div className="relative z-10 space-y-6">
          <BrandMark variant="light" className="max-w-md" />
          <p className="text-lg text-white/85 leading-relaxed max-w-md font-sans font-normal">
            Компании, бригады, заселение, финансы и документы в одном интерфейсе.
          </p>
        </div>
        <p className="relative z-10 text-xs text-white/50">ХостелМиг</p>
      </div>

      <div className="flex-1 flex items-center justify-center bg-app-mesh px-5 py-12 sm:px-8">
        <div className="w-full max-w-[420px]">
          <div className="lg:hidden mb-10 text-center">
            <BrandMark />
          </div>

          <div className="rounded-2xl border border-border/80 bg-card/90 backdrop-blur-sm p-8 sm:p-10 shadow-xl shadow-foreground/5">
            <div className="mb-8">
              <h2 className="font-display text-3xl font-semibold text-foreground tracking-tight">Вход</h2>
              <p className="mt-2 text-sm text-muted-foreground">Рабочий кабинет</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label
                  htmlFor="email"
                  className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  data-testid="login-email-input"
                  autoComplete="email"
                  className="h-11 rounded-xl border-border bg-background/80"
                />
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="password"
                  className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Пароль
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  data-testid="login-password-input"
                  autoComplete="current-password"
                  className="h-11 rounded-xl border-border bg-background/80"
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                data-testid="login-submit-button"
                className="w-full h-11 rounded-xl font-semibold shadow-md shadow-primary/25"
              >
                {loading ? 'Вход…' : 'Войти'}
              </Button>
            </form>

          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
