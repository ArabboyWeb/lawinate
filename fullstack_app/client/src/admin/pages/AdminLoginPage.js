import React, { useContext, useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { LockKey, ShieldCheck, UserCircle } from '@phosphor-icons/react';
import { AdminAuthContext } from '../AdminAuthContext';
import adminApi from '../adminApi';
import { useToast } from '../components/ToastContext';

const AdminLoginPage = () => {
  const { login, loginWithGoogle } = useContext(AdminAuthContext);
  const { pushToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const queryError = searchParams.get('error');

  const resolveErrorMessage = (err, fallback) => {
    if (err?.response?.data?.error) return err.response.data.error;
    if (err?.code === 'ERR_NETWORK' || /Network Error/i.test(String(err?.message || ''))) {
      return "Server bilan aloqa yo'q. 5-10 soniyadan keyin qayta urinib ko'ring.";
    }
    return fallback;
  };

  useEffect(() => {
    let active = true;

    adminApi.get('/api/auth/providers')
      .then((res) => {
        if (!active) return;
        setGoogleEnabled(Boolean(res.data?.google?.enabled));
      })
      .catch(() => {
        if (!active) return;
        setGoogleEnabled(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);

    try {
      await login(email, password, rememberMe);
      pushToast('Muvaffaqiyatli kirildi', 'success');
      const from = location.state?.from?.pathname || '/admin/dashboard';
      navigate(from, { replace: true });
    } catch (err) {
      pushToast(resolveErrorMessage(err, 'Login muvaffaqiyatsiz'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (event) => {
    event.preventDefault();
    if (!email) {
      pushToast('Email kiriting', 'error');
      return;
    }
    setResetLoading(true);
    try {
      const res = await adminApi.post('/api/admin/auth/forgot-password', { email });
      pushToast(res.data?.message || 'So`rov yuborildi', 'info');
    } catch (err) {
      pushToast(resolveErrorMessage(err, 'Parolni tiklash so`rovi yuborilmadi'), 'error');
    } finally {
      setResetLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      await loginWithGoogle('/admin/dashboard');
    } catch (err) {
      pushToast(resolveErrorMessage(err, 'Google login ishlamadi'), 'error');
      setGoogleLoading(false);
    }
  };

  return (
    <div className="font-inter min-h-screen bg-[#08111d] text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_12%_12%,rgba(13,108,242,0.18),transparent_26%),radial-gradient(circle_at_88%_16%,rgba(60,200,217,0.14),transparent_24%),radial-gradient(circle_at_84%_84%,rgba(13,159,131,0.12),transparent_26%)]" />
      <div className="relative mx-auto grid min-h-screen w-full max-w-[1120px] items-center gap-4 px-4 py-4 sm:px-5 sm:py-6 lg:grid-cols-[0.94fr,1.06fr] lg:gap-6 lg:px-6 lg:py-8">
        <section className="admin-glass admin-login-hero p-5 sm:p-6 lg:p-8">
          <p className="admin-login-kicker mb-3 inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-200">
            <ShieldCheck size={14} />
            Admin kirish
          </p>
          <h1 className="text-3xl font-bold text-white">Lawinate.uz</h1>
          <p className="mt-4 text-sm text-slate-300">
            Platformani boshqarish uchun kirish oynasi. Asosiy bo'limlar bir joyda va mobil ekranda ham qulay.
          </p>

          <div className="admin-login-points mt-6 grid gap-3 text-sm text-slate-300">
            <div className="admin-login-point">Testlar va kutubxona ustida tez ishlang.</div>
            <div className="admin-login-point">Foydalanuvchilar, chat va AI oqimini nazorat qiling.</div>
            <div className="admin-login-point">Kundalik boshqaruv uchun toza va ixcham kirish oynasi.</div>
          </div>
        </section>

        <section className="admin-glass admin-login-form p-5 sm:p-6 lg:p-8">
          <div className="mb-5 flex items-center gap-2">
            <div className="rounded-[18px] border border-white/10 bg-white/5 p-2">
              <UserCircle size={22} />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Admin panelga kirish</h2>
              <p className="text-xs text-slate-400">Email va parol bilan davom eting</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="grid gap-4">
            <div>
              <label className="mb-1 block text-xs text-slate-300" htmlFor="admin-email">Email</label>
              <input
                id="admin-email"
                className="admin-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-slate-300" htmlFor="admin-password">Parol</label>
              <div className="relative">
                <LockKey size={16} className="pointer-events-none absolute left-3 top-3 text-slate-400" />
                <input
                  id="admin-password"
                  className="admin-input pl-9"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="admin-login-actions-row flex flex-wrap items-center justify-between gap-3 text-sm text-slate-300">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                Eslab qolish
              </label>
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-sky-300 hover:text-sky-200"
                disabled={resetLoading}
              >
                {resetLoading ? 'Yuborilmoqda...' : 'Parolni tiklash'}
              </button>
            </div>

            <button type="submit" className="admin-btn-primary w-full" disabled={loading}>
              {loading ? 'Kirish tekshirilmoqda...' : 'Admin panelga kirish'}
            </button>

            {googleEnabled && (
              <button type="button" className="admin-btn-soft w-full" onClick={handleGoogleLogin} disabled={googleLoading}>
                {googleLoading ? 'Googlega yo\'naltirilmoqda...' : 'Google bilan kirish'}
              </button>
            )}

            {queryError && (
              <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {queryError}
              </div>
            )}
          </form>
        </section>
      </div>
    </div>
  );
};

export default AdminLoginPage;
