import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMockAction } from '../../shared/useMockAction';

interface Trip {
  id: string;
  driver: string;
  driverInitial: string;
  from: string;
  to: string;
  timing: string;
  timeDetail: string;
  passengers: string;
  status: 'active' | 'scheduled' | 'completed' | 'cancelled';
  color: string;
}

const mockTrips: Trip[] = [
  {
    id: '#TR-8921',
    driver: 'أحمد العلي',
    driverInitial: 'أ.ع',
    from: 'دمشق',
    to: 'حلب',
    timing: 'today',
    timeDetail: '04:30 م',
    passengers: '3/4',
    status: 'active',
    color: 'secondary',
  },
  {
    id: '#TR-8945',
    driver: 'محمود سعيد',
    driverInitial: 'م.س',
    from: 'حمص',
    to: 'اللاذقية',
    timing: 'tomorrow',
    timeDetail: '09:00 ص',
    passengers: '1/4',
    status: 'scheduled',
    color: 'primary',
  },
  {
    id: '#TR-8700',
    driver: 'نور حسن',
    driverInitial: 'ن.ح',
    from: 'دمشق',
    to: 'طرطوس',
    timing: 'yesterday',
    timeDetail: '11:15 ص',
    passengers: '4/4',
    status: 'completed',
    color: 'slate',
  },
];

const Trips: React.FC = () => {
  const { t } = useTranslation();
  const { runAction, isBusy, feedback, clearFeedback } = useMockAction();
  const [trips, setTrips] = useState<Trip[]>(mockTrips);
  const [activeFilter, setActiveFilter] = useState<Trip['status'] | 'all'>('all');
  const [selectedTripId, setSelectedTripId] = useState<string>(mockTrips[0].id);

  const visibleTrips = useMemo(() => {
    if (activeFilter === 'all') {
      return trips;
    }
    return trips.filter((trip) => trip.status === activeFilter);
  }, [activeFilter, trips]);

  const selectedTrip = useMemo(
    () => trips.find((trip) => trip.id === selectedTripId) ?? trips[0],
    [selectedTripId, trips],
  );

  return (
    <div className="grid grid-cols-12 gap-8">
      {/* Left Column: Trips Management */}
      <div className="col-span-12 xl:col-span-8 space-y-10">
        {feedback && (
          <div className={`rounded-xl px-4 py-3 text-sm font-semibold border ${
            feedback.tone === 'success'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : feedback.tone === 'error'
              ? 'bg-red-50 text-red-700 border-red-200'
              : 'bg-indigo-50 text-indigo-700 border-indigo-200'
          }`}>
            <div className="flex items-center justify-between gap-3">
              <span>{feedback.message}</span>
              <button onClick={clearFeedback} className="text-xs underline underline-offset-2">Dismiss</button>
            </div>
          </div>
        )}

        {/* Filters Section */}
        <section className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex p-1 bg-surface-container-low rounded-xl">
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-6 py-2 text-sm font-medium rounded-lg ${activeFilter === 'all' ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface transition-colors'}`}
            >
              {t('trips.filter_all')}
            </button>
            <button onClick={() => setActiveFilter('active')} className={`px-6 py-2 text-sm font-medium transition-colors ${activeFilter === 'active' ? 'text-primary font-bold' : 'text-on-surface-variant hover:text-on-surface'}`}>
              {t('trips.filter_active')}
            </button>
            <button onClick={() => setActiveFilter('scheduled')} className={`px-6 py-2 text-sm font-medium transition-colors ${activeFilter === 'scheduled' ? 'text-primary font-bold' : 'text-on-surface-variant hover:text-on-surface'}`}>
              {t('trips.filter_scheduled')}
            </button>
            <button onClick={() => setActiveFilter('completed')} className={`px-6 py-2 text-sm font-medium transition-colors ${activeFilter === 'completed' ? 'text-primary font-bold' : 'text-on-surface-variant hover:text-on-surface'}`}>
              {t('trips.filter_completed')}
            </button>
            <button onClick={() => setActiveFilter('cancelled')} className={`px-6 py-2 text-sm font-medium transition-colors ${activeFilter === 'cancelled' ? 'text-primary font-bold' : 'text-on-surface-variant hover:text-on-surface'}`}>
              {t('trips.filter_cancelled')}
            </button>
          </div>
          <button
            onClick={async () => {
              await runAction({
                key: 'new-trip',
                successMessage: 'Trip draft created and queued for backend validation.',
                errorMessage: 'Could not create trip draft.',
                onSuccess: () => {
                  setTrips((prev) => [{
                    id: `#TR-${9000 + prev.length}`,
                    driver: 'سائق جديد',
                    driverInitial: 'س.ج',
                    from: 'الرياض',
                    to: 'جدة',
                    timing: 'today',
                    timeDetail: '07:30 م',
                    passengers: '0/4',
                    status: 'scheduled',
                    color: 'primary',
                  }, ...prev]);
                },
              });
            }}
            disabled={isBusy('new-trip')}
            className="flex items-center gap-2 bg-primary text-on-primary px-5 py-2.5 rounded-xl font-medium shadow-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            <span>{isBusy('new-trip') ? 'Creating...' : t('trips.new_trip')}</span>
          </button>
        </section>

        {/* Trips Bento Table */}
        <section className="bg-surface-container-lowest rounded-[2rem] p-8 shadow-ambient border border-outline-variant/10">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="text-start border-b border-outline-variant/10">
                  <th className="pb-6 font-headline font-bold text-on-surface-variant text-sm px-4 text-start">{t('trips.table_trip_id')}</th>
                  <th className="pb-6 font-headline font-bold text-on-surface-variant text-sm px-4 text-start">{t('trips.table_driver')}</th>
                  <th className="pb-6 font-headline font-bold text-on-surface-variant text-sm px-4 text-start">{t('trips.table_route')}</th>
                  <th className="pb-6 font-headline font-bold text-on-surface-variant text-sm px-4 text-start">{t('trips.table_timing')}</th>
                  <th className="pb-6 font-headline font-bold text-on-surface-variant text-sm px-4 text-center">{t('trips.table_passengers')}</th>
                  <th className="pb-6 font-headline font-bold text-on-surface-variant text-sm px-4 text-start">{t('trips.table_status')}</th>
                  <th className="pb-6 font-headline font-bold text-on-surface-variant text-sm px-4 ltr:text-right rtl:text-left">{t('trips.table_actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/5">
                {visibleTrips.map((trip) => (
                  <tr
                    key={trip.id}
                    onClick={() => setSelectedTripId(trip.id)}
                    className={`group hover:bg-surface-container-low/30 transition-colors cursor-pointer ${selectedTripId === trip.id ? 'bg-surface-container-low/40' : ''}`}
                  >
                    <td className="py-6 px-4 font-bold text-primary text-start">{trip.id}</td>
                    <td className="py-6 px-4 text-start">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full ${trip.status === 'active' ? 'bg-secondary/10 text-secondary' : trip.status === 'scheduled' ? 'bg-primary/10 text-primary' : 'bg-slate-200 text-slate-600'} flex items-center justify-center font-bold text-xs`}>
                          {trip.driverInitial}
                        </div>
                        <span className="text-sm font-medium">{trip.driver}</span>
                      </div>
                    </td>
                    <td className="py-6 px-4 text-start">
                      <div className="flex items-center gap-2 text-sm">
                        <span>{trip.from}</span>
                        <span className="material-symbols-outlined text-xs text-outline rotate-180 ltr:rotate-0">trending_flat</span>
                        <span>{trip.to}</span>
                      </div>
                    </td>
                    <td className="py-6 px-4 text-start">
                      <p className="text-sm font-medium">{t(`dashboard.${trip.timing}`)}</p>
                      <p className="text-[10px] text-on-surface-variant ltr:font-mono">{trip.timeDetail}</p>
                    </td>
                    <td className="py-6 px-4 text-center">
                      <span className="bg-surface-container-high px-2.5 py-1 rounded-full text-xs font-bold ltr:font-mono">{trip.passengers}</span>
                    </td>
                    <td className="py-6 px-4 text-start">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        trip.status === 'active' ? 'bg-secondary-container text-on-secondary-container' :
                        trip.status === 'scheduled' ? 'bg-tertiary-fixed text-on-tertiary-fixed-variant' :
                        'bg-surface-container text-on-surface-variant'
                      }`}>
                        {t(`trips.filter_${trip.status}`)}
                      </span>
                    </td>
                    <td className="py-6 px-4">
                      <div className="flex items-center ltr:justify-end rtl:justify-start gap-2">
                        {trip.status === 'completed' ? (
                            <button
                              onClick={async (event) => {
                                event.stopPropagation();
                                await runAction({
                                  key: `history-${trip.id}`,
                                  successMessage: `${trip.id} history opened.`,
                                  errorMessage: 'Could not load trip history.',
                                });
                              }}
                              disabled={isBusy(`history-${trip.id}`)}
                              className="p-2 text-on-surface-variant hover:text-primary transition-colors disabled:opacity-40"
                            >
                            <span className="material-symbols-outlined text-lg">history</span>
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={async (event) => {
                                event.stopPropagation();
                                setSelectedTripId(trip.id);
                                await runAction({
                                  key: `view-${trip.id}`,
                                  successMessage: `${trip.id} details refreshed.`,
                                  errorMessage: 'Failed to load trip details.',
                                });
                              }}
                              disabled={isBusy(`view-${trip.id}`)}
                              className="p-2 text-on-surface-variant hover:text-primary transition-colors disabled:opacity-40"
                            >
                              <span className="material-symbols-outlined text-lg">visibility</span>
                            </button>
                            <button
                              onClick={async (event) => {
                                event.stopPropagation();
                                await runAction({
                                  key: `cancel-${trip.id}`,
                                  successMessage: `${trip.id} marked as cancelled.`,
                                  errorMessage: 'Could not cancel trip.',
                                  onSuccess: () => {
                                    setTrips((prev) => prev.map((entry) => entry.id === trip.id ? { ...entry, status: 'cancelled' } : entry));
                                  },
                                });
                              }}
                              disabled={isBusy(`cancel-${trip.id}`) || trip.status === 'cancelled'}
                              className="p-2 text-on-surface-variant hover:text-error transition-colors disabled:opacity-40"
                            >
                              <span className="material-symbols-outlined text-lg">cancel</span>
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Asymmetric Detailed Trip Preview Card */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-primary-container text-on-primary-container p-8 rounded-[2rem] flex flex-col justify-between min-h-[280px] shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20"></div>
            <div>
              <h3 className="font-headline text-2xl font-bold mb-2">{t('trips.active_trip_details')}</h3>
              <p className="text-primary-fixed-dim/80 text-sm">{t('trips.on_the_road', { from: selectedTrip?.from ?? '---', to: selectedTrip?.to ?? '---' })}</p>
            </div>
            <div className="mt-8 grid grid-cols-2 gap-4 relative z-10">
              <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-sm">
                <p className="text-[10px] uppercase font-bold tracking-tighter opacity-70">{t('trips.expected_time')}</p>
                <p className="text-lg font-bold">45 {t('trips.minutes_ago', { count: '' }).replace(/منذ\s*/, '')}</p>
              </div>
              <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-sm">
                <p className="text-[10px] uppercase font-bold tracking-tighter opacity-70">{t('trips.remaining_distance')}</p>
                <p className="text-lg font-bold">32 كم</p>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-between">
              <div className="flex -space-x-3 rtl:space-x-reverse">
                {[1, 2, 3].map((i) => (
                  <img
                    key={i}
                    className="w-10 h-10 rounded-full border-2 border-primary-container object-cover"
                    src={`https://i.pravatar.cc/100?u=passenger${i}`}
                    alt="Passenger"
                  />
                ))}
                <div className="w-10 h-10 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center text-xs font-bold border-2 border-primary-container">+2</div>
              </div>
              <button
                onClick={async () => {
                  await runAction({
                    key: 'contact-driver',
                    successMessage: `Contact request sent to ${selectedTrip?.driver ?? 'driver'}.`,
                    errorMessage: 'Could not send contact request.',
                  });
                }}
                disabled={isBusy('contact-driver')}
                className="bg-secondary text-on-secondary px-6 py-2 rounded-xl text-sm font-bold shadow-md hover:opacity-90 transition-all disabled:opacity-50"
              >
                {t('trips.contact_driver')}
              </button>
            </div>
          </div>
          <div className="bg-surface-container-low rounded-[2rem] overflow-hidden min-h-[280px] shadow-md border border-outline-variant/10 group">
            <div className="relative w-full h-full min-h-[280px]">
              <img
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuAW37uKeof3vFq5zp_d1XIvkt3pM-_wKF6DhFl_mJAAlZ0Ia18vBiB26v9tcMFJf9wHs35F18kiLisecwZaMXVmvhGQWt199kxckLStN87ojDaPLbOZpkhxUWinmjpXc2TSUo3m-er-WogDvlRLFFQt-DIwojglj1tHNN_mklIBR1dXQVaCWv1coUqUXQ5B0osPhEYLVRcNQKXfl6QSEZRnQWhNAgt_fj-0SzkLx25hbmh1nD2ycpWJX64YpgL853AkwXvXOILfnss"
                alt="Map"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
              <div className="absolute bottom-6 right-6 text-white">
                <div className="flex items-center gap-2 mb-1">
                  <span className="material-symbols-outlined text-secondary-fixed">location_on</span>
                  <span className="text-sm font-bold">{t('trips.live_map')}</span>
                </div>
                <p className="text-[10px] opacity-70">{t('trips.map_update_freq')}</p>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Right Column: Monitoring Sidebar */}
      <aside className="col-span-12 xl:col-span-4 space-y-8">
        {/* Live Statistics Card */}
        <div className="bg-surface-container-low p-8 rounded-[2rem] border border-outline-variant/5">
          <h4 className="font-headline font-bold text-lg mb-6 text-primary">{t('trips.route_monitoring')}</h4>
          <div className="space-y-6">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">دمشق - حلب</span>
                <span className="text-xs font-bold text-secondary">{t('trips.congestion.very_high')}</span>
              </div>
              <div className="h-1.5 w-full bg-surface-container-high rounded-full overflow-hidden">
                <div className="h-full bg-secondary w-[85%]"></div>
              </div>
              <p className="text-[10px] text-on-surface-variant mt-2">
                {t('trips.current_trips', { count: 12 })} | {t('trips.current_passengers', { count: 48 })}
              </p>
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">حمص - طرطوس</span>
                <span className="text-xs font-bold text-on-surface-variant">{t('trips.congestion.medium')}</span>
              </div>
              <div className="h-1.5 w-full bg-surface-container-high rounded-full overflow-hidden">
                <div className="h-full bg-primary-container w-[45%]"></div>
              </div>
              <p className="text-[10px] text-on-surface-variant mt-2">
                {t('trips.current_trips', { count: 5 })} | {t('trips.current_passengers', { count: 18 })}
              </p>
            </div>
          </div>
        </div>

        {/* Real-time Event Feed */}
        <div className="bg-white/40 border border-outline-variant/20 p-8 rounded-[2rem] glass">
          <h4 className="font-headline font-bold text-lg mb-6 text-primary">{t('trips.recent_activity')}</h4>
          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-secondary shrink-0">
                <span className="material-symbols-outlined text-lg">check_circle</span>
              </div>
              <div>
                <p className="text-sm font-bold">{t('trips.trip_completed', { id: '#TR-8690' })}</p>
                <p className="text-xs text-on-surface-variant">
                  {t('trips.arrival_notification', { name: 'سامر', dest: 'حلب', time: t('trips.minutes_ago', { count: 4 }) })}
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-500 shrink-0">
                <span className="material-symbols-outlined text-lg">warning</span>
              </div>
              <div>
                <p className="text-sm font-bold">{t('trips.trip_delay', { id: '#TR-8921' })}</p>
                <p className="text-xs text-on-surface-variant">{t('trips.traffic_congestion', { location: 'مدخل حلب' })}</p>
              </div>
            </div>
          </div>
          <button className="w-full mt-8 py-3 text-sm font-bold text-primary border-t border-outline-variant/10 hover:bg-surface-container transition-colors rounded-b-xl">
            {t('trips.view_all_activity')}
          </button>
        </div>

        {/* Driver Performance Shortcut */}
        <div className="bg-gradient-to-br from-tertiary-container to-tertiary p-8 rounded-[2rem] text-on-tertiary shadow-lg">
          <div className="flex justify-between items-start mb-6">
            <h4 className="font-headline font-bold text-lg">{t('trips.top_drivers')}</h4>
            <span className="material-symbols-outlined opacity-50">star</span>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-secondary-fixed text-on-secondary-fixed flex items-center justify-center text-[10px] font-bold">1</div>
                <span className="text-sm font-medium">خالد الأحمد</span>
              </div>
              <div className="flex items-center gap-1 text-secondary-fixed">
                <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                <span className="text-xs font-bold">4.9</span>
              </div>
            </div>
            <div className="flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white/20 text-white flex items-center justify-center text-[10px] font-bold">2</div>
                <span className="text-sm font-medium">سارة منصور</span>
              </div>
              <div className="flex items-center gap-1 text-secondary-fixed">
                <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                <span className="text-xs font-bold">4.8</span>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
};

export default Trips;
