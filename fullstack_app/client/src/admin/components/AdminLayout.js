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
    <div className="font-inter min-h-screen bg-slate-100 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(14,165,233,0.15),transparent_40%),radial-gradient(circle_at_85%_85%,rgba(59,130,246,0.14),transparent_45%)]" />

      <div className="relative z-10 flex min-h-screen">
        <aside className={`fixed inset-y-0 left-0 z-40 w-72 border-r border-white/10 bg-slate-950/90 p-4 backdrop-blur-xl transition-transform dark:bg-slate-950/80 ${menuOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
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
                  className={({ isActive }) => `flex items-center gap-3 rounded-2xl border px-3 py-2.5 text-sm transition ${isActive ? 'border-sky-400/40 bg-sky-500/20 text-sky-200' : 'border-transparent text-slate-300 hover:border-white/20 hover:bg-white/10'}`}
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
          <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-900/70 backdrop-blur-xl dark:bg-slate-950/60">
            <div className="mx-auto flex h-16 w-full max-w-[1400px] items-center justify-between px-4 lg:px-8">
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setMenuOpen(true)} className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-200 lg:hidden">
                  <List size={20} />
                </button>
                <div>
                  <h2 className="text-base font-semibold text-white">{pageTitle}</h2>
                  <p className="text-xs text-slate-400">Uzbekistan admin workspace</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
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
