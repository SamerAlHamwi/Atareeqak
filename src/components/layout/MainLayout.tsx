import React, { useEffect, useRef, useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { useAuth } from '../../app/context/useAuth';
import { canAccess } from '../../app/roles';
import { useTranslation } from 'react-i18next';
import { toggleLanguage } from '../../app/i18n';
import Avatar from '../../features/shared/components/Avatar';
import { NAV_ITEMS } from './navItems';

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
    <div className="bg-[#f8fafc] text-slate-900 min-h-screen font-sans" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 z-[60] lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* SideNavBar Shell */}
      <aside className={`
        fixed top-0 h-screen w-80 z-[70] bg-white transition-all duration-300 ease-in-out
        ${isRtl ? 'right-0 border-l' : 'left-0 border-r'} border-slate-100
        ${isSidebarOpen
            ? (isRtl ? 'translate-x-0' : 'translate-x-0')
            : (isRtl ? 'translate-x-full lg:translate-x-0' : '-translate-x-full lg:translate-x-0')
        }
        flex flex-col
      `}>
        <div className="flex flex-col items-center py-12 px-6">
          <div className="flex flex-col items-center">
             <span className="text-3xl font-black text-[#000666]">{t('auth.brand_name')}</span>
             <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">
               {t('nav.smart_dashboard')}
             </p>
          </div>
        </div>

        <nav className="flex-1 px-6 space-y-2 overflow-y-auto">
          {visibleNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setIsSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-4 px-5 py-4 rounded-2xl text-sm font-black transition-all duration-200 ${
                  isActive
                    ? 'bg-[#d1f5ea] text-[#134e48]'
                    : 'text-slate-500 hover:bg-slate-50'
                }`
              }
            >
              <span className="material-symbols-outlined text-2xl font-bold">{item.icon}</span>
              <span>{t(item.labelKey)}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-6 border-t border-slate-50">
          <button
            onClick={logout}
            className={`w-full flex items-center justify-between px-5 py-4 text-slate-500 font-black text-sm hover:bg-slate-50 rounded-2xl transition-colors`}
          >
             <span>{t('nav.logout')}</span>
             <span className={`material-symbols-outlined text-2xl ${isRtl ? 'rotate-180' : ''}`}>logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className={`
        ${isRtl ? 'lg:mr-80' : 'lg:ml-80'}
        min-h-screen flex flex-col transition-all duration-300
      `}>
        {/* TopAppBar */}
        <header className="flex items-center justify-between px-6 lg:px-10 h-24 w-full sticky top-0 z-40 bg-[#f8fafc]/80 backdrop-blur-md">
          {/* Mobile Menu Icon */}
          <button
            className="lg:hidden p-2 text-slate-500 hover:bg-white rounded-xl transition-colors"
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
                  <p className="text-sm font-black text-[#000666] leading-none">
                    {user?.name || t('header.admin_name')}
                  </p>
                  <p className="text-[11px] font-bold text-slate-400 mt-1.5">
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
                  className={`absolute top-full mt-2 w-72 bg-white rounded-2xl shadow-ambient border border-slate-100 py-2 z-50 ${
                    isRtl ? 'left-0' : 'right-0'
                  }`}
                >
                  <div className="px-5 py-3 border-b border-slate-50">
                    <p className="text-sm font-black text-[#000666]" data-testid="header-profile-name">
                      {user?.name || t('header.admin_name')}
                    </p>
                    <p className="text-xs font-bold text-slate-400 mt-0.5" data-testid="header-profile-role">
                      {user?.roleLabel || (role ? t(`roles.${role}`) : t('header.admin_role'))}
                    </p>
                    {user?.email && (
                      <p
                        className="text-xs text-slate-400 mt-2 truncate ltr:font-mono"
                        dir="ltr"
                        data-testid="header-profile-email"
                      >
                        {user.email}
                      </p>
                    )}
                    <p className="text-xs text-slate-400 mt-1" data-testid="header-profile-last-login">
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
                    className="w-full flex items-center justify-between px-5 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    <span>{t('header.toggle_language')}</span>
                    <span className="text-slate-400">{isRtl ? 'English' : 'العربية'}</span>
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
        <footer className="w-full h-16 flex items-center justify-center px-10 text-slate-400 text-sm">
           <p>{t('footer.copyright')}</p>
        </footer>
      </main>
    </div>
  );
};

export default MainLayout;
