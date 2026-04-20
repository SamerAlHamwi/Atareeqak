import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../app/context/AuthContext';
import { useTranslation } from 'react-i18next';

const MainLayout: React.FC = () => {
  const { logout } = useAuth();
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Robust RTL check
  const isRtl = i18n.language.startsWith('ar');

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location]);

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
             <span className="text-3xl font-black text-[#000666]">عطريقك</span>
             <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">
               {isRtl ? 'لوحة التحكم الذكية' : 'Smart Dashboard'}
             </p>
          </div>
        </div>

        <nav className="flex-1 px-6 space-y-2 overflow-y-auto">
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              `flex items-center gap-4 px-5 py-4 rounded-2xl text-sm font-black transition-all duration-200 ${
                isActive
                  ? 'bg-[#d1f5ea] text-[#134e48]'
                  : 'text-slate-500 hover:bg-slate-50'
              }`
            }
          >
            <span className="material-symbols-outlined text-2xl font-bold">grid_view</span>
            <span>{t('nav.dashboard')}</span>
          </NavLink>
          <NavLink
            to="/trips"
            className={({ isActive }) =>
              `flex items-center gap-4 px-5 py-4 rounded-2xl text-sm font-black transition-all duration-200 ${
                isActive
                  ? 'bg-[#d1f5ea] text-[#134e48]'
                  : 'text-slate-500 hover:bg-slate-50'
              }`
            }
          >
            <span className="material-symbols-outlined text-2xl font-bold">directions_car</span>
            <span>{t('nav.trips')}</span>
          </NavLink>
          <NavLink
            to="/drivers"
            className={({ isActive }) =>
              `flex items-center gap-4 px-5 py-4 rounded-2xl text-sm font-black transition-all duration-200 ${
                isActive
                  ? 'bg-[#d1f5ea] text-[#134e48]'
                  : 'text-slate-500 hover:bg-slate-50'
              }`
            }
          >
            <span className="material-symbols-outlined text-2xl font-bold">person</span>
            <span>{t('nav.drivers')}</span>
          </NavLink>
          <NavLink
            to="/passengers"
            className={({ isActive }) =>
              `flex items-center gap-4 px-5 py-4 rounded-2xl text-sm font-black transition-all duration-200 ${
                isActive
                  ? 'bg-[#d1f5ea] text-[#134e48]'
                  : 'text-slate-500 hover:bg-slate-50'
              }`
            }
          >
            <span className="material-symbols-outlined text-2xl font-bold">group</span>
            <span>{t('nav.passengers')}</span>
          </NavLink>
          <NavLink
            to="/reports"
            className={({ isActive }) =>
              `flex items-center gap-4 px-5 py-4 rounded-2xl text-sm font-black transition-all duration-200 ${
                isActive
                  ? 'bg-[#d1f5ea] text-[#134e48]'
                  : 'text-slate-500 hover:bg-slate-50'
              }`
            }
          >
            <span className="material-symbols-outlined text-2xl font-bold">assessment</span>
            <span>{t('nav.reports')}</span>
          </NavLink>
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `flex items-center gap-4 px-5 py-4 rounded-2xl text-sm font-black transition-all duration-200 ${
                isActive
                  ? 'bg-[#d1f5ea] text-[#134e48]'
                  : 'text-slate-500 hover:bg-slate-50'
              }`
            }
          >
            <span className="material-symbols-outlined text-2xl font-bold">settings</span>
            <span>{t('nav.settings')}</span>
          </NavLink>
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

          <div className="flex items-center flex-1 justify-center px-4">
            <div className="relative w-full max-w-xl">
              <span className={`absolute inset-y-0 ${isRtl ? 'right-0 pr-5' : 'left-0 pl-5'} flex items-center pointer-events-none text-slate-400`}>
                <span className="material-symbols-outlined">search</span>
              </span>
              <input
                className={`block w-full ${isRtl ? 'pr-14' : 'pl-14'} py-3.5 bg-white border border-slate-100 rounded-2xl text-sm placeholder-slate-400 focus:ring-0 shadow-sm transition-all`}
                placeholder={t('header.search_placeholder')}
                type="text"
              />
            </div>
          </div>

          <div className="flex items-center gap-4 lg:gap-8">
             <div className="hidden md:flex items-center gap-3">
                <button className="hover:bg-white rounded-full p-2.5 text-slate-400 shadow-sm border border-transparent hover:border-slate-100 transition-all">
                  <span className="material-symbols-outlined">help_outline</span>
                </button>
                <button className="hover:bg-white rounded-full p-2.5 text-slate-400 relative shadow-sm border border-transparent hover:border-slate-100 transition-all">
                  <span className="material-symbols-outlined">notifications</span>
                  <span className={`absolute top-2.5 ${isRtl ? 'left-2.5' : 'right-2.5'} w-2 h-2 bg-red-500 rounded-full border-2 border-white`}></span>
                </button>
             </div>

            <div className={`flex items-center gap-4 ${isRtl ? 'lg:pr-8' : 'lg:pl-8'}`}>
              <div className="hidden sm:flex text-right rtl flex flex-col">
                <p className="text-sm font-black text-[#000666] leading-none">{t('header.admin_name')}</p>
                <p className="text-[11px] font-bold text-slate-400 mt-1.5">{t('header.admin_role')}</p>
              </div>
              <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-slate-200 overflow-hidden border-2 lg:border-4 border-white shadow-md">
                <img
                    alt="Profile"
                    className="w-full h-full object-cover"
                    src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
                />
              </div>
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
