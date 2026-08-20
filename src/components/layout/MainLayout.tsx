import React, { useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { Menu, LogOut, Languages } from 'lucide-react';
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

  const visibleNavItems = NAV_ITEMS.filter((item) => canAccess(role, item.section));

  // Robust RTL check
  const isRtl = i18n.language.startsWith('ar');

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
                    <item.icon size={20} />
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
            type="button"
            onClick={() => toggleLanguage()}
            data-testid="sidebar-toggle-language"
            className="w-full flex items-center justify-between px-4 py-3 text-on-surface-variant font-bold text-sm hover:bg-surface-container-low rounded-xl transition-colors duration-200"
          >
            <span>{t('header.toggle_language')}</span>
            <span className="flex items-center gap-2 text-on-surface-variant/60">
              {isRtl ? 'English' : 'العربية'}
              <Languages size={18} />
            </span>
          </button>
          <button
            data-testid="sidebar-logout"
            onClick={logout}
            className="w-full flex items-center justify-between px-4 py-3 text-error font-bold text-sm bg-error-container/0 hover:bg-error-container/20 rounded-xl transition-colors duration-200"
          >
             <span>{t('nav.logout')}</span>
             <LogOut size={20} className={isRtl ? 'rotate-180' : ''} />
          </button>
        </div>
      </aside>

      {/* Mobile Menu Trigger */}
      <button
        className={`lg:hidden fixed top-4 z-[65] p-2.5 bg-surface-container-lowest text-on-surface-variant rounded-xl shadow-ambient transition-colors ${
          isRtl ? 'right-4' : 'left-4'
        }`}
        onClick={() => setIsSidebarOpen(true)}
      >
         <Menu size={24} />
      </button>

      {/* Main Content Area */}
      <main className={`
        ${isRtl ? 'lg:mr-72' : 'lg:ml-72'}
        min-h-screen flex flex-col transition-all duration-300
      `}>
        {/* Content */}
        <div className="p-6 pt-20 lg:p-10 flex-1">
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
