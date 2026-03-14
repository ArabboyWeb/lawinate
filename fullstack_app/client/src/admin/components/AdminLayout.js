import React, { useContext, useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  ChartBar,
  ChatsCircle,
  Gear,
  ListChecks,
  Robot,
  SignOut,
  SquaresFour,
  Users,
  Books,
  Sun,
  Moon,
  List,
  X,
} from '@phosphor-icons/react';
import { AdminAuthContext } from '../AdminAuthContext';

const navItems = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: SquaresFour },
  { to: '/admin/tests', label: 'Testlar', icon: ListChecks },
  { to: '/admin/library', label: 'Kutubxona', icon: Books },
  { to: '/admin/users', label: 'Foydalanuvchilar', icon: Users },
  { to: '/admin/community', label: 'Community', icon: ChatsCircle },
  { to: '/admin/ai', label: 'AI', icon: Robot },
  { to: '/admin/settings', label: 'Settings', icon: Gear },
];

const titleMap = {
  '/admin/dashboard': 'Admin Dashboard',
  '/admin/tests': 'Tests Management',
  '/admin/library': 'Library Management',
  '/admin/users': 'Users Management',
  '/admin/community': 'Community Moderation',
  '/admin/ai': 'AI Assistant',
  '/admin/settings': 'Platform Settings',
};

const AdminLayout = () => {
  const { admin, logout } = useContext(AdminAuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [theme, setTheme] = useState(() => localStorage.getItem('admin_theme') || 'dark');
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('admin_theme', theme);
  }, [theme]);

  const pageTitle = useMemo(() => {
    const matched = Object.keys(titleMap).find((path) => location.pathname.startsWith(path));
    return matched ? titleMap[matched] : 'Admin Panel';
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login');
  };

  return (
    <div className="font-inter min-h-screen bg-[#eef6f9] text-slate-900 transition-colors dark:bg-[#08111d] dark:text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_12%_10%,rgba(13,108,242,0.16),transparent_28%),radial-gradient(circle_at_88%_16%,rgba(60,200,217,0.14),transparent_24%),radial-gradient(circle_at_82%_84%,rgba(13,159,131,0.10),transparent_26%)]" />

      <div className="relative z-10 flex min-h-screen">
        <aside className={`fixed inset-y-0 left-0 z-40 w-[86vw] max-w-[320px] border-r border-white/10 bg-[#061426]/92 p-4 backdrop-blur-2xl transition-transform dark:bg-[#061426]/84 ${menuOpen ? 'translate-x-0' : '-translate-x-full'} lg:w-72 lg:max-w-none lg:translate-x-0`}>
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Lawinate.uz</p>
              <h1 className="text-xl font-bold text-white">Admin Panel</h1>
            </div>
            <button type="button" onClick={() => setMenuOpen(false)} className="rounded-xl p-2 text-slate-300 hover:bg-white/10 lg:hidden">
              <X size={20} />
            </button>
          </div>

          <nav className="grid gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) => `flex items-center gap-3 rounded-[20px] border px-3 py-2.5 text-sm transition ${isActive ? 'border-sky-400/40 bg-sky-500/20 text-sky-200 shadow-[0_20px_40px_-30px_rgba(13,108,242,0.55)]' : 'border-transparent text-slate-300 hover:border-white/16 hover:bg-white/8'}`}
                >
                  <Icon size={18} />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>

          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
            <p className="font-semibold text-white">{admin?.full_name || 'Admin'}</p>
            <p className="text-xs text-slate-400">{admin?.email}</p>
            <p className="mt-1 text-xs uppercase tracking-wider text-sky-300">{admin?.role}</p>
          </div>
        </aside>

        <div className="flex w-full flex-1 flex-col lg:pl-72">
          <header className="sticky top-0 z-30 border-b border-white/10 bg-[#08182f]/72 backdrop-blur-2xl dark:bg-[#08111d]/62">
            <div className="mx-auto flex min-h-16 w-full max-w-[1400px] flex-wrap items-center justify-between gap-y-3 px-4 py-3 lg:flex-nowrap lg:px-8">
              <div className="flex min-w-0 items-center gap-3">
                <button type="button" onClick={() => setMenuOpen(true)} className="rounded-2xl border border-white/10 bg-white/5 p-2 text-slate-200 lg:hidden">
                  <List size={20} />
                </button>
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold text-white">{pageTitle}</h2>
                  <p className="text-xs text-slate-400">Platforma boshqaruvi</p>
                </div>
              </div>

              <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:flex-nowrap">
                <button
                  type="button"
                  onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
                  className="admin-btn-soft"
                >
                  {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                  {theme === 'dark' ? 'Light' : 'Dark'}
                </button>

                <button type="button" onClick={handleLogout} className="admin-btn-primary">
                  <SignOut size={16} />
                  Chiqish
                </button>
              </div>
            </div>
          </header>

          <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 lg:px-8 lg:py-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
};

export default AdminLayout;
