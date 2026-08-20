import React, { useEffect, useRef, useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { useAuth } from '../../app/context/useAuth';
import { canAccess } from '../../app/roles';
import { useTranslation } from 'react-i18next';
import { toggleLanguage } from '../../app/i18n';
import Avatar from '../../features/shared/components/Avatar';
import { NAV_ITEMS } from './navItems';
import logo from '../../assets/logo.png';

const MainLayout: React.FC = () => {
  const { logout, user, role } = useAuth();
  const { t, i18n } = useTranslation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  const visibleNavItems = NAV_ITEMS.filter((item) => canAccess(role, item.section));

  // Robust RTL check
  const isRtl = i18n.language.startsWith('ar');

  useEffect(() => {
    if (!isProfileMenuOpen) {
      return;
    }
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isProfileMenuOpen]);

  const formattedLastLogin = user?.lastLoginAt
    ? new Date(user.lastLoginAt).toLocaleString(i18n.language, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <div className="bg-surface text-on-surface min-h-screen font-sans" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-primary-container/50 z-[60] lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* SideNavBar Shell */}
      <aside className={`
        fixed top-0 h-screen w-72 z-[70] bg-surface-container-lowest transition-all duration-300 ease-in-out
        ${isRtl ? 'right-0 border-l' : 'left-0 border-r'} border-outline-variant/15
        ${isSidebarOpen
            ? (isRtl ? 'translate-x-0' : 'translate-x-0')
            : (isRtl ? 'translate-x-full lg:translate-x-0' : '-translate-x-full lg:translate-x-0')
        }
        flex flex-col shadow-ambient lg:shadow-none
      `}>
        {/* Brand */}
        <div className="flex flex-col items-center pt-10 pb-8 px-6">
          <div className="relative mb-3">
            <div className="absolute inset-0 bg-secondary/15 rounded-2xl blur-xl scale-110" aria-hidden="true" />
            <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-surface-container-low to-surface-container flex items-center justify-center shadow-ambient ring-1 ring-outline-variant/20">
              <img src={logo} alt={t('auth.brand_name')} className="w-9 h-9 object-contain" />
            </div>
          </div>
          <span className="text-2xl font-black text-primary tracking-tight">{t('auth.brand_name')}</span>
          <p className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-[0.2em] mt-1">
            {t('nav.smart_dashboard')}
          </p>
        </div>

        <div className="mx-6 h-px bg-outline-variant/20" />

        {/* Nav */}
        <nav className="flex-1 px-4 pt-6 space-y-1 overflow-y-auto">
          <p className="px-3 mb-2 text-[10px] font-bold text-on-surface-variant/50 uppercase tracking-[0.2em]">
            {t('nav.main_menu')}
          </p>
          {visibleNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setIsSidebarOpen(false)}
              className={({ isActive }) =>
                `group relative flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-bold transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-primary to-primary-container text-on-primary shadow-ambient'
                    : 'text-on-surface-variant hover:bg-surface-container-low hover:text-primary'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`absolute top-1/2 -translate-y-1/2 ${isRtl ? 'right-0' : 'left-0'} h-5 w-1 rounded-full bg-secondary transition-all duration-200 ${
                      isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'
                    }`}
                    aria-hidden="true"
                  />
                  <span
                    className={`flex items-center justify-center w-9 h-9 rounded-lg transition-colors duration-200 ${
                      isActive ? 'bg-white/15 text-on-primary' : 'bg-surface-container text-on-surface-variant group-hover:bg-surface-container-high group-hover:text-primary'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                  </span>
                  <span className="truncate">{t(item.labelKey)}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 mt-2">
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-surface-container-low mb-2">
            <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 ring-2 ring-surface-container-lowest shadow-sm">
              <Avatar name={user?.name || t('header.admin_name')} photo={null} size="xl" className="rounded-none" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black text-on-surface truncate">{user?.name || t('header.admin_name')}</p>
              <p className="text-[11px] font-bold text-on-surface-variant/60 truncate">
                {user?.roleLabel || (role ? t(`roles.${role}`) : t('header.admin_role'))}
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center justify-between px-4 py-3 text-error font-bold text-sm bg-error-container/0 hover:bg-error-container/20 rounded-xl transition-colors duration-200"
          >
             <span>{t('nav.logout')}</span>
             <span className={`material-symbols-outlined text-xl ${isRtl ? 'rotate-180' : ''}`}>logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className={`
        ${isRtl ? 'lg:mr-72' : 'lg:ml-72'}
        min-h-screen flex flex-col transition-all duration-300
      `}>
        {/* TopAppBar */}
        <header className="flex items-center justify-between px-6 lg:px-10 h-24 w-full sticky top-0 z-40 bg-surface/80 backdrop-blur-md">
          {/* Mobile Menu Icon */}
          <button
            className="lg:hidden p-2 text-on-surface-variant hover:bg-surface-container-lowest rounded-xl transition-colors"
            onClick={() => setIsSidebarOpen(true)}
          >
             <span className="material-symbols-outlined text-3xl">menu</span>
          </button>

          <div className="flex-1" />

          <div className="flex items-center gap-4 lg:gap-8">
            <div className={`relative ${isRtl ? 'lg:pr-8' : 'lg:pl-8'}`} ref={profileMenuRef}>
              <button
                type="button"
                onClick={() => setIsProfileMenuOpen((open) => !open)}
                aria-haspopup="menu"
                aria-expanded={isProfileMenuOpen}
                data-testid="header-profile-trigger"
                className="flex items-center gap-4 rounded-2xl transition-colors hover:bg-white/60 p-1"
              >
                <div className="hidden sm:flex text-right rtl flex flex-col">
                  <p className="text-sm font-black text-primary leading-none">
                    {user?.name || t('header.admin_name')}
                  </p>
                  <p className="text-[11px] font-bold text-on-surface-variant/70 mt-1.5">
                    {user?.roleLabel || (role ? t(`roles.${role}`) : t('header.admin_role'))}
                  </p>
                </div>
                {/*
                  Was a hardcoded Unsplash portrait of an unrelated person. The
                  logged-in employee has no photo endpoint (`POST /admin/photo`
                  is a stub that cannot be completed — BUG-12), so initials it is.
                */}
                <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-full overflow-hidden border-2 lg:border-4 border-surface-container-lowest shadow-md">
                  <Avatar
                    name={user?.name || t('header.admin_name')}
                    photo={null}
                    size="xl"
                    className="rounded-none"
                  />
                </div>
              </button>

              {isProfileMenuOpen && (
                <div
                  role="menu"
                  data-testid="header-profile-menu"
                  className={`absolute top-full mt-2 w-72 bg-surface-container-lowest rounded-2xl shadow-ambient border border-outline-variant/20 py-2 z-50 ${
                    isRtl ? 'left-0' : 'right-0'
                  }`}
                >
                  <div className="px-5 py-3 border-b border-outline-variant">
                    <p className="text-sm font-black text-primary" data-testid="header-profile-name">
                      {user?.name || t('header.admin_name')}
                    </p>
                    <p className="text-xs font-bold text-on-surface-variant/70 mt-0.5" data-testid="header-profile-role">
                      {user?.roleLabel || (role ? t(`roles.${role}`) : t('header.admin_role'))}
                    </p>
                    {user?.email && (
                      <p
                        className="text-xs text-on-surface-variant/70 mt-2 truncate ltr:font-mono"
                        dir="ltr"
                        data-testid="header-profile-email"
                      >
                        {user.email}
                      </p>
                    )}
                    <p className="text-xs text-on-surface-variant/70 mt-1" data-testid="header-profile-last-login">
                      {t('header.last_login')}: {formattedLastLogin ?? t('staff.never_logged_in')}
                    </p>
                  </div>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      toggleLanguage();
                      setIsProfileMenuOpen(false);
                    }}
                    data-testid="header-toggle-language"
                    className="w-full flex items-center justify-between px-5 py-3 text-sm font-bold text-on-surface-variant hover:bg-surface-container-low transition-colors"
                  >
                    <span>{t('header.toggle_language')}</span>
                    <span className="text-on-surface-variant/60">{isRtl ? 'English' : 'العربية'}</span>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      logout();
                    }}
                    data-testid="header-logout"
                    className="w-full flex items-center justify-between px-5 py-3 text-sm font-bold text-error hover:bg-error-container/20 transition-colors"
                  >
                    <span>{t('nav.logout')}</span>
                    <span className={`material-symbols-outlined text-xl ${isRtl ? 'rotate-180' : ''}`}>logout</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="p-6 lg:p-10 flex-1">
          <Outlet />
        </div>

        {/* Footer */}
        <footer className="w-full h-16 flex items-center justify-center px-10 text-on-surface-variant/70 text-sm">
           <p>{t('footer.copyright')}</p>
        </footer>
      </main>
    </div>
  );
};

export default MainLayout;
