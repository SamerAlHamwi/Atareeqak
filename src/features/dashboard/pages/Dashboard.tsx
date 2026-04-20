import React from 'react';
import { useTranslation } from 'react-i18next';

const Dashboard: React.FC = () => {
  const { t } = useTranslation();

  const stats = [
    { label: t('dashboard.total_users'), value: '12,450', growth: '1.2%', color: 'text-emerald-500', trend: 'up' },
    { label: t('dashboard.active_trips'), value: '342', growth: t('dashboard.live'), isBadge: true },
    { label: t('dashboard.completed_trips'), value: '8,921' },
    { label: t('dashboard.total_revenue'), value: '$45,200', isPrimary: true },
  ];

  const sideStats = [
     { label: t('dashboard.pending_complaints'), value: '14', sub: t('dashboard.requires_action'), color: 'text-red-500' },
     { label: t('dashboard.verification_requests'), value: '28' }
  ];

  const recentActivities = [
    {
      user: 'أحمد العلي',
      phone: 'XXX-XXX-0933',
      driver: 'سامر حسن',
      route: 'المزرعة ← الميدان',
      date: `${t('dashboard.today')}, 10:45 ص`,
      status: t('dashboard.status.active'),
      statusColor: 'bg-teal-50 text-teal-600',
      value: '12,500 ل.س',
    },
    {
      user: 'لينا إبراهيم',
      phone: 'XXX-XXX-0944',
      driver: 'عمر مصطفى',
      route: 'أوتوستراد المزة ← الجسر الأبيض',
      date: `${t('dashboard.today')}, 09:30 ص`,
      status: t('dashboard.status.completed'),
      statusColor: 'bg-emerald-50 text-emerald-600',
      value: '8,000 ل.س',
    },
    {
      user: 'خالد محمود',
      phone: 'XXX-XXX-0955',
      driver: 'ياسر عيسى',
      route: 'المشروع ← المشفى الجامعي',
      date: `${t('dashboard.yesterday')}, 11:20 م`,
      status: t('dashboard.status.cancelled'),
      statusColor: 'bg-red-50 text-red-400',
      value: '---',
    },
  ];

  const cityDistribution = [
    { name: t('dashboard.cities.damascus'), percentage: 45, color: 'bg-[#000666]' },
    { name: t('dashboard.cities.aleppo'), percentage: 28, color: 'bg-[#006a6a]' },
    { name: t('dashboard.cities.homs'), percentage: 15, color: 'bg-[#006a6a]' },
    { name: t('dashboard.cities.latakia'), percentage: 12, color: 'bg-[#000666]' },
  ];

  return (
    <div className="space-y-10 pb-10">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-4xl font-black text-[#000666] tracking-tight">{t('dashboard.title')}</h1>
          <p className="text-slate-400 font-bold text-sm">{t('dashboard.welcome_back')}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-100 text-slate-700 rounded-[1.25rem] font-black text-sm shadow-sm hover:bg-slate-50 transition-all">
            <span className="material-symbols-outlined text-lg">export_notes</span>
            {t('dashboard.export_data')}
          </button>
          <button className="flex items-center gap-2 px-6 py-3 bg-[#000666] text-white rounded-[1.25rem] font-black text-sm shadow-lg shadow-indigo-900/20 hover:opacity-90 transition-all">
            <span className="material-symbols-outlined text-lg">person_add</span>
            {t('dashboard.add_employee')}
          </button>
          <button className="flex items-center gap-2 px-6 py-3 bg-[#006a6a] text-white rounded-[1.25rem] font-black text-sm shadow-lg shadow-teal-900/20 hover:opacity-90 transition-all">
            <span className="material-symbols-outlined text-lg">campaign</span>
            {t('dashboard.send_alert')}
          </button>
        </div>
      </div>

      {/* Grid Content: 75% | 25% */}
      <div className="grid grid-cols-12 gap-8">

        {/* Left/Main Column (75%) */}
        <div className="col-span-12 lg:col-span-9 space-y-8">
          {/* 4 Stats Cards Row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {stats.map((stat, i) => (
              <div
                key={i}
                className={`${
                  stat.isPrimary ? 'bg-[#212396] text-white' : 'bg-white text-slate-900'
                } p-8 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col justify-between h-44 relative overflow-hidden`}
              >
                <span className={`${stat.isPrimary ? 'text-indigo-100' : 'text-slate-400'} text-[13px] font-black`}>
                  {stat.label}
                </span>
                <div className="mt-auto">
                   <div className="flex items-center gap-3">
                      <span className="text-3xl font-black tracking-tight">{stat.value}</span>
                      {stat.growth && !stat.isBadge && (
                         <div className="flex items-center gap-1 text-[11px] font-black text-emerald-500 bg-emerald-50 px-2 py-1 rounded-full">
                            <span className="material-symbols-outlined text-[12px] font-bold">arrow_upward</span>
                            {stat.growth}
                         </div>
                      )}
                      {stat.isBadge && (
                         <span className="text-[11px] font-black bg-teal-50 text-teal-600 px-3 py-1 rounded-full border border-teal-100">
                           {stat.growth}
                         </span>
                      )}
                   </div>
                </div>
                {stat.isPrimary && (
                  <div className="absolute bottom-0 left-0 right-0 h-10 bg-white/10 flex items-end px-1 gap-1">
                     <div className="w-full h-4 bg-teal-400/40 rounded-t-md"></div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Growth Chart (Wide) */}
          <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100">
             <div className="flex items-center justify-between mb-12">
                <div>
                  <h3 className="text-2xl font-black text-[#000666]">{t('dashboard.growth_chart_title')}</h3>
                  <p className="text-sm text-slate-400 font-bold mt-1.5">{t('dashboard.growth_chart_subtitle')}</p>
                </div>
                <div className="bg-slate-50 px-5 py-2.5 rounded-xl text-xs font-black text-slate-500 border border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors">
                   {t('dashboard.last_6_months')}
                </div>
             </div>

             <div className="h-80 w-full flex items-end justify-between px-6 pb-6">
                {[t('dashboard.months.jan'), t('dashboard.months.feb'), t('dashboard.months.mar'), t('dashboard.months.apr'), t('dashboard.months.may'), t('dashboard.months.jun')].map((month, i) => (
                  <div key={i} className="flex flex-col items-center gap-5 flex-1">
                     <div className="relative w-full flex justify-center items-end h-56 gap-2">
                        <div className="w-4 bg-indigo-50 rounded-full h-[65%] hover:bg-indigo-100 transition-all cursor-pointer"></div>
                        <div className="w-4 bg-[#006a6a] rounded-full h-[90%] shadow-lg shadow-teal-900/10 hover:opacity-90 transition-all cursor-pointer"></div>
                     </div>
                     <span className="text-xs font-black text-slate-400">{month}</span>
                  </div>
                ))}
             </div>

             <div className="flex justify-center gap-12 mt-10 pt-10 border-t border-slate-50">
                <div className="flex items-center gap-3">
                   <div className="w-3.5 h-3.5 rounded-full bg-[#006a6a]"></div>
                   <span className="text-sm font-black text-slate-500">{t('dashboard.legend_completed')}</span>
                </div>
                <div className="flex items-center gap-3">
                   <div className="w-3.5 h-3.5 rounded-full bg-indigo-100"></div>
                   <span className="text-sm font-black text-slate-500">{t('dashboard.legend_new_users')}</span>
                </div>
             </div>
          </div>
        </div>

        {/* Right Column (25%) */}
        <div className="col-span-12 lg:col-span-3 space-y-8">
           {/* Side Stats Grid */}
           <div className="grid grid-cols-1 gap-6">
              {sideStats.map((stat, i) => (
                <div key={i} className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center h-44">
                   <span className="text-slate-400 text-[13px] font-black mb-3">{stat.label}</span>
                   <span className={`text-4xl font-black ${stat.color || 'text-[#000666]'}`}>{stat.value}</span>
                   {stat.sub && <span className="text-[11px] text-slate-400 font-bold mt-2">{stat.sub}</span>}
                </div>
              ))}
           </div>

           {/* City Distribution (Vertical Stack) */}
           <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100 h-full">
              <h3 className="text-xl font-black text-[#000666] mb-10">{t('dashboard.city_distribution')}</h3>
              <div className="space-y-12">
                 {cityDistribution.map((city, i) => (
                   <div key={i} className="space-y-4">
                      <div className="flex justify-between items-center text-sm font-black">
                         <span className="text-slate-900">{city.name}</span>
                         <span className="text-slate-400">{city.percentage}%</span>
                      </div>
                      <div className="h-2.5 w-full bg-slate-50 rounded-full overflow-hidden">
                         <div className={`h-full ${city.color} rounded-full transition-all duration-1000`} style={{ width: `${city.percentage}%` }}></div>
                      </div>
                   </div>
                 ))}
              </div>
           </div>
        </div>

        {/* Full Width Bottom Table */}
        <div className="col-span-12 bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-12">
            <h3 className="text-2xl font-black text-[#000666]">{t('dashboard.recent_activities')}</h3>
            <button className="text-teal-600 text-sm font-black hover:underline underline-offset-8 transition-all">{t('dashboard.view_all')}</button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead>
                <tr className="text-slate-400 text-xs font-black border-b border-slate-50 uppercase tracking-widest">
                  <th className="pb-8 pr-6 font-black">{t('dashboard.table_user')}</th>
                  <th className="pb-8 font-black text-center">{t('dashboard.table_driver')}</th>
                  <th className="pb-8 font-black text-center">{t('dashboard.table_route')}</th>
                  <th className="pb-8 font-black text-center">{t('dashboard.table_date')}</th>
                  <th className="pb-8 font-black text-center">{t('dashboard.table_status')}</th>
                  <th className="pb-8 pl-6 font-black text-left">{t('dashboard.table_value')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {recentActivities.map((ride, i) => (
                  <tr key={i} className="group hover:bg-slate-50/50 transition-colors">
                    <td className="py-8 pr-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-slate-100 flex-shrink-0 border-4 border-white shadow-sm overflow-hidden">
                           <div className="w-full h-full bg-slate-200"></div>
                        </div>
                        <div>
                          <p className="text-[15px] font-black text-slate-900 leading-tight">{ride.user}</p>
                          <p className="text-[11px] font-bold text-slate-400 mt-1.5">
                            {t('dashboard.phone_label')}: {ride.phone}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-8 text-[15px] font-bold text-slate-600 text-center">{ride.driver}</td>
                    <td className="py-8 text-[15px] font-bold text-slate-600 text-center">{ride.route}</td>
                    <td className="py-8 text-[14px] font-bold text-slate-400 text-center">{ride.date}</td>
                    <td className="py-8 text-center">
                      <span className={`px-5 py-2 rounded-full text-[11px] font-black ${ride.statusColor}`}>
                        {ride.status}
                      </span>
                    </td>
                    <td className="py-8 pl-6 text-[15px] font-black text-slate-900 text-left">{ride.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
