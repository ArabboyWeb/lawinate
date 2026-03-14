import React, { useContext, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  List,
  Scales,
  ShieldCheck,
  SignOut,
  Sparkle,
  UserCircle,
  X,
} from '@phosphor-icons/react';
import { AuthContext } from '../contexts/AuthContext';

const links = [
  { to: '/ranking', label: 'Reyting' },
  { to: '/library', label: 'Kutubxona' },
  { to: '/tests', label: 'Testlar' },
  { to: '/dashboard', label: 'Kabinet' },
];

const NavBar = () => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const hasAdminAccess = ['admin', 'moderator'].includes(user?.role);
  const profileLabel = user?.full_name?.split(' ')[0] || 'Profil';

  const handleLogout = () => {
    logout();
    setMenuOpen(false);
    navigate('/');
  };

  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="glass-nav">
      <div className="site-container nav-shell">
        <NavLink to="/" className="brand" onClick={closeMenu}>
          <Scales size={30} weight="fill" style={{ color: 'var(--law-blue)' }} />
          <span>
            Lawinate<span className="brand-accent">.uz</span>
          </span>
        </NavLink>

        <nav className="desktop-links">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                isActive ? 'nav-pill active' : 'nav-pill'
              }
            >
              {link.label}
            </NavLink>
          ))}
          <NavLink
            to="/ai"
            className={({ isActive }) =>
              isActive ? 'nav-pill ai-pill active' : 'nav-pill ai-pill'
            }
          >
            <Sparkle size={16} weight="bold" />
            AI Assistant
          </NavLink>
          {hasAdminAccess && (
            <NavLink
              to="/admin/dashboard"
              className={({ isActive }) =>
                isActive ? 'nav-pill active' : 'nav-pill'
              }
            >
              <ShieldCheck size={16} weight="bold" />
              Control Panel
            </NavLink>
          )}
        </nav>

        {user && (
          <NavLink to="/dashboard" className="mobile-profile-shortcut" onClick={closeMenu}>
            {user.profile_image ? (
              <img
                src={user.profile_image}
                alt={user.full_name || 'Profil'}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  objectFit: 'cover',
                }}
              />
            ) : (
              <UserCircle size={22} weight="fill" />
            )}
            <span>{profileLabel}</span>
          </NavLink>
        )}

        <div className="desktop-auth">
          {user ? (
            <>
              <NavLink to="/dashboard" className="nav-pill">
                {user.profile_image ? (
                  <img
                    src={user.profile_image}
                    alt={user.full_name || 'Profil'}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      objectFit: 'cover',
                    }}
                  />
                ) : (
                  <UserCircle size={16} weight="fill" />
                )}
                {profileLabel}
              </NavLink>
              <button type="button" className="btn btn-danger" onClick={handleLogout}>
                <SignOut size={16} weight="bold" /> Chiqish
              </button>
            </>
          ) : (
            <>
              <NavLink to="/auth" className="nav-pill">
                Kirish
              </NavLink>
              <NavLink to="/auth" className="btn btn-primary">
                Ro'yxatdan o'tish
              </NavLink>
            </>
          )}
        </div>

        <button
          type="button"
          className="mobile-toggle"
          onClick={() => setMenuOpen((prev) => !prev)}
          aria-label="Mobile menu"
        >
          {menuOpen ? <X size={28} weight="bold" /> : <List size={28} weight="bold" />}
        </button>
      </div>

      <div className={menuOpen ? 'mobile-menu open' : 'mobile-menu'}>
        {links.map((link) => (
          <NavLink
            key={`mobile-${link.to}`}
            to={link.to}
            onClick={closeMenu}
            className={({ isActive }) =>
              isActive ? 'mobile-link active' : 'mobile-link'
            }
          >
            {link.label}
          </NavLink>
        ))}

        <NavLink
          to="/ai"
          onClick={closeMenu}
          className={({ isActive }) =>
            isActive ? 'mobile-link active' : 'mobile-link'
          }
        >
          AI Assistant
        </NavLink>

        {hasAdminAccess && (
          <NavLink
            to="/admin/dashboard"
            onClick={closeMenu}
            className={({ isActive }) =>
              isActive ? 'mobile-link active' : 'mobile-link'
            }
          >
            Control Panel
          </NavLink>
        )}

        {user ? (
          <button type="button" className="btn btn-danger" onClick={handleLogout}>
            Chiqish
          </button>
        ) : (
          <div className="actions">
            <NavLink to="/auth" onClick={closeMenu} className="btn btn-soft">
              Kirish
            </NavLink>
            <NavLink to="/auth" onClick={closeMenu} className="btn btn-primary">
              Ro'yxatdan o'tish
            </NavLink>
          </div>
        )}
      </div>
    </header>
  );
};

export default NavBar;
