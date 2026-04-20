import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ActionBanner from '../../shared/components/ActionBanner';
import { useMockAction } from '../../shared/useMockAction';

interface TripItem {
  id: string;
  date: string;
  time: string;
  from: string;
  to: string;
  fareSar: number;
  riderRating: number;
  riderComment: string;
}

interface DocumentItem {
  id: string;
  name: string;
  status: 'verified' | 'needs_update';
}

const initialTrips: TripItem[] = [
  {
    id: '1',
    date: '12 أكتوبر 2023',
    time: '08:45 م',
    from: 'حي النخيل',
    to: 'مطار الملك خالد',
    fareSar: 85,
    riderRating: 5,
    riderComment: 'سائق محترم جداً',
  },
  {
    id: '2',
    date: '12 أكتوبر 2023',
    time: '04:15 م',
    from: 'الرياض بارك',
    to: 'العليا',
    fareSar: 32,
    riderRating: 4,
    riderComment: 'السيارة نظيفة',
  },
  {
    id: '3',
    date: '11 أكتوبر 2023',
    time: '11:20 ص',
    from: 'جامعة الملك سعود',
    to: 'حي حطين',
    fareSar: 45,
    riderRating: 5,
    riderComment: 'وصول سريع',
  },
  {
    id: '4',
    date: '10 أكتوبر 2023',
    time: '09:05 م',
    from: 'غرناطة مول',
    to: 'الملز',
    fareSar: 41,
    riderRating: 4.5,
    riderComment: 'التزام بالمواعيد',
  },
  {
    id: '5',
    date: '10 أكتوبر 2023',
    time: '02:35 م',
    from: 'حي الياسمين',
    to: 'المروج',
    fareSar: 28,
    riderRating: 4,
    riderComment: 'رحلة مريحة',
  },
];

const initialDocuments: DocumentItem[] = [
  { id: 'doc-1', name: 'الهوية الوطنية', status: 'verified' },
  { id: 'doc-2', name: 'رخصة القيادة', status: 'verified' },
  { id: 'doc-3', name: 'التأمين', status: 'verified' },
  { id: 'doc-4', name: 'استمارة المركبة', status: 'verified' },
];

const DriverDetails: React.FC = () => {
  const { i18n } = useTranslation();
  const { driverId } = useParams();
  const navigate = useNavigate();
  const { runAction, isBusy, feedback, clearFeedback } = useMockAction();

  const [isAvailable, setIsAvailable] = useState(true);
  const [isFrozen, setIsFrozen] = useState(false);
  const [documents, setDocuments] = useState<DocumentItem[]>(initialDocuments);
  const [showAllTrips, setShowAllTrips] = useState(false);
  const [trips, setTrips] = useState<TripItem[]>(initialTrips);

  const isRtl = i18n.language.startsWith('ar');

  const visibleTrips = useMemo(() => (showAllTrips ? trips : trips.slice(0, 3)), [showAllTrips, trips]);
  const totalEarnings = useMemo(() => trips.reduce((sum, trip) => sum + trip.fareSar, 0), [trips]);
  const avgTripRating = useMemo(() => {
    const value = trips.reduce((sum, trip) => sum + trip.riderRating, 0) / trips.length;
    return value.toFixed(2);
  }, [trips]);

  return (
    <div className="space-y-8" dir={isRtl ? 'rtl' : 'ltr'}>
      <ActionBanner feedback={feedback} onDismiss={clearFeedback} />

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/drivers')}
          className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline"
        >
          <span className="material-symbols-outlined text-base">arrow_back</span>
          العودة إلى قائمة السائقين
        </button>
        <span className="text-xs text-on-surface-variant">Driver ID: {driverId ?? 'N/A'}</span>
      </div>

      <section className="bg-surface-container-lowest rounded-xl p-8 flex flex-col md:flex-row items-start md:items-center gap-8 border border-outline-variant/20">
        <div className="relative shrink-0">
          <div className="h-28 w-28 md:h-32 md:w-32 rounded-full overflow-hidden border-4 border-secondary-container ring-4 ring-primary/5">
            <img
              alt="Driver Photo"
              className="w-full h-full object-cover"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuBBg-ENkUNakRyNaroLUp-NfqFpXLQM0Rx5O1V51jD7zUVdtiGJSJdsEiyJbt-MeCP5E1xhA67lke2UIpwJdTap4NqyFZaLYBwQNvp4jF_depvk8B99n6_wfr9ZpqtFkaB1SCUJBKIdjwTtyAVzhMhfEykPiGN862pF6uLWSd4S9BmvmfyM9jTyG4yMFpDMuIVE8jiEFpy4rBtv_64Qe0gcVSs--gJk5rVythd1C4G2MCjMLMZVxvUkHPx-6cAi6FdH2StqbCuwgSM"
            />
          </div>
          <div className="absolute bottom-1 right-1 bg-secondary text-white h-8 w-8 rounded-full flex items-center justify-center border-2 border-white">
            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
          </div>
        </div>

        <div className="flex-1 text-right space-y-2">
          <div className="flex flex-wrap items-center gap-4 justify-end">
            <h2 className="text-2xl md:text-3xl font-extrabold text-primary font-headline">أحمد محمد الخالدي</h2>
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${isFrozen ? 'bg-error-container text-on-error-container' : 'bg-secondary-container text-on-secondary-container'}`}>
              {isFrozen ? 'الحساب مجمّد' : 'نشط حالياً'}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-4 md:gap-6 text-on-surface-variant font-medium justify-end text-sm">
            <span className="inline-flex items-center gap-1"><span className="material-symbols-outlined text-sm">id_card</span> DR-9921</span>
            <span className="inline-flex items-center gap-1"><span className="material-symbols-outlined text-sm">calendar_today</span> عضو منذ: يناير 2021</span>
            <span className="inline-flex items-center gap-1 text-on-surface bg-surface-container-high px-2 py-0.5 rounded">
              <span className="material-symbols-outlined text-amber-500" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
              {avgTripRating}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={async () => {
              await runAction({
                key: 'edit-driver-profile',
                successMessage: 'تم فتح وضع تعديل الملف.',
                errorMessage: 'تعذر فتح تعديل الملف.',
              });
            }}
            disabled={isBusy('edit-driver-profile')}
            className="bg-primary text-on-primary px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:opacity-90 transition-all disabled:opacity-50"
          >
            <span className="material-symbols-outlined">edit</span>
            {isBusy('edit-driver-profile') ? 'جاري الفتح...' : 'تعديل الملف'}
          </button>
          <button
            type="button"
            onClick={async () => {
              await runAction({
                key: 'send-driver-message',
                successMessage: 'تم إرسال الرسالة إلى السائق.',
                errorMessage: 'تعذر إرسال الرسالة.',
              });
            }}
            disabled={isBusy('send-driver-message')}
            className="bg-surface-container-high text-on-surface px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-surface-container-highest transition-all disabled:opacity-50"
          >
            <span className="material-symbols-outlined">chat</span>
            {isBusy('send-driver-message') ? 'جاري الإرسال...' : 'إرسال رسالة'}
          </button>
          <button
            type="button"
            onClick={async () => {
              await runAction({
                key: 'toggle-freeze-driver',
                successMessage: isFrozen ? 'تم إعادة تنشيط الحساب.' : 'تم تجميد الحساب بنجاح.',
                errorMessage: 'تعذر تحديث حالة الحساب.',
                onSuccess: () => setIsFrozen((prev) => !prev),
              });
            }}
            disabled={isBusy('toggle-freeze-driver')}
            className="bg-error-container text-error px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:opacity-90 transition-all disabled:opacity-50"
          >
            <span className="material-symbols-outlined">block</span>
            {isBusy('toggle-freeze-driver') ? 'جاري التحديث...' : isFrozen ? 'إلغاء التجميد' : 'تجميد الحساب'}
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <div className="bg-surface-container-lowest p-6 rounded-xl space-y-3">
          <div className="flex justify-between items-center">
            <span className="material-symbols-outlined text-secondary bg-secondary-container/30 p-2 rounded-lg">route</span>
            <span className="text-on-surface-variant text-sm font-bold">إجمالي الرحلات</span>
          </div>
          <div className="text-3xl font-extrabold text-primary font-headline">1,482</div>
          <div className="text-xs text-secondary font-bold inline-flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">trending_up</span>
            +12% هذا الشهر
          </div>
        </div>

        <div className="bg-surface-container-lowest p-6 rounded-xl space-y-3">
          <div className="flex justify-between items-center">
            <span className="material-symbols-outlined text-secondary bg-secondary-container/30 p-2 rounded-lg">account_balance_wallet</span>
            <span className="text-on-surface-variant text-sm font-bold">إجمالي الأرباح</span>
          </div>
          <div className="text-3xl font-extrabold text-primary font-headline">{totalEarnings.toLocaleString('ar-SA')} <span className="text-lg font-medium">ر.س</span></div>
          <div className="text-xs text-on-surface-variant font-bold">صافي الربح بعد الرسوم</div>
        </div>

        <div className="bg-surface-container-lowest p-6 rounded-xl space-y-3">
          <div className="flex justify-between items-center">
            <span className="material-symbols-outlined text-error bg-error-container/30 p-2 rounded-lg">cancel</span>
            <span className="text-on-surface-variant text-sm font-bold">معدل الإلغاء</span>
          </div>
          <div className="text-3xl font-extrabold text-error font-headline">2.4%</div>
          <div className="text-xs text-secondary font-bold">أقل من المتوسط العام</div>
        </div>

        <div className="bg-surface-container-lowest p-6 rounded-xl flex flex-col justify-between">
          <div className="flex justify-between items-center">
            <span className="material-symbols-outlined text-primary bg-primary-container/10 p-2 rounded-lg">sensors</span>
            <span className="text-on-surface-variant text-sm font-bold">حالة التوافر</span>
          </div>
          <div className="flex items-center justify-between mt-4">
            <span className="font-bold text-on-surface">{isAvailable ? 'متصل الآن' : 'غير متصل'}</span>
            <button
              type="button"
              onClick={async () => {
                await runAction({
                  key: 'toggle-availability',
                  successMessage: isAvailable ? 'تم تحويل الحالة إلى غير متصل.' : 'تم تحويل الحالة إلى متصل الآن.',
                  errorMessage: 'تعذر تحديث حالة التوافر.',
                  onSuccess: () => setIsAvailable((prev) => !prev),
                });
              }}
              disabled={isBusy('toggle-availability')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isAvailable ? 'bg-secondary' : 'bg-surface-container-high'} disabled:opacity-50`}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${isAvailable ? 'translate-x-1' : 'translate-x-5'}`} />
            </button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-8">
          <div className="bg-surface-container-lowest rounded-xl overflow-hidden">
            <div className="h-48 w-full bg-surface-container-high relative">
              <img
                alt="Vehicle Photo"
                className="w-full h-full object-cover"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuBXYuBwWznejHEwd6UFi69pCBbdAGlZnix8W91v0iWXmS1BBH0vwAgHmZoKqUrjPwVsJrPjparSLL0gGSdwdDMbTHVzy0_m760D1kjuawNw_7-HVUq7IJhPHFMYo5Wbxg26YCPtUkwjPmVE0s7ID6EM40l-br9-3TPhUbmbGFeKCP7sS1hDFd0BKC24-tepV4VstkpibN-DJTgpHv1UL6558-x0L51G2-CJJM7kZo__CjOVDNgIVOG0AUKnf3U0emwNdoad6rLucw0"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4">
                <h3 className="text-white font-bold text-lg">كيا سيراتو 2021</h3>
              </div>
            </div>
            <div className="p-6 space-y-4 text-sm">
              <div className="flex justify-between items-center border-b border-surface-container-low pb-3">
                <span className="text-on-surface-variant">رقم اللوحة</span>
                <span className="font-bold font-headline tracking-widest text-primary">ح ص ر 4821</span>
              </div>
              <div className="flex justify-between items-center border-b border-surface-container-low pb-3">
                <span className="text-on-surface-variant">اللون</span>
                <div className="flex items-center gap-2">
                  <span className="font-bold">رمادي داكن</span>
                  <span className="w-4 h-4 rounded-full bg-slate-700 shadow-sm border border-white" />
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-on-surface-variant">نوع السيارة</span>
                <span className="font-bold">سيدان - اقتصادي</span>
              </div>
            </div>
          </div>

          <div className="bg-surface-container-lowest rounded-xl p-6 space-y-6">
            <h3 className="text-lg font-extrabold text-primary font-headline flex items-center gap-2 border-b border-surface-container-low pb-4">
              <span className="material-symbols-outlined">verified_user</span>
              التحقق والمستندات
            </h3>
            <div className="space-y-3">
              {documents.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between p-3 bg-surface rounded-lg">
                  <div className="flex items-center gap-3">
                    <span
                      className={`material-symbols-outlined ${doc.status === 'verified' ? 'text-secondary' : 'text-amber-600'}`}
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      {doc.status === 'verified' ? 'check_circle' : 'warning'}
                    </span>
                    <span className="font-medium">{doc.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await runAction({
                        key: `view-${doc.id}`,
                        successMessage: `تم فتح ملف ${doc.name}.`,
                        errorMessage: `تعذر فتح ملف ${doc.name}.`,
                      });
                    }}
                    disabled={isBusy(`view-${doc.id}`)}
                    className="text-secondary font-bold text-sm hover:underline disabled:opacity-50"
                  >
                    عرض الملف
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={async () => {
                await runAction({
                  key: 'request-doc-update',
                  successMessage: 'تم إرسال طلب تحديث المستندات للسائق.',
                  errorMessage: 'تعذر إرسال طلب تحديث المستندات.',
                  onSuccess: () => {
                    setDocuments((prev) => prev.map((doc, index) => {
                      if (index !== 2) {
                        return doc;
                      }
                      return { ...doc, status: 'needs_update' };
                    }));
                  },
                });
              }}
              disabled={isBusy('request-doc-update')}
              className="w-full py-3 text-secondary border-2 border-secondary rounded-xl font-bold hover:bg-secondary/5 transition-all disabled:opacity-50"
            >
              {isBusy('request-doc-update') ? 'جاري الإرسال...' : 'تحديث المستندات'}
            </button>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-8">
          <div className="bg-surface-container-lowest rounded-xl overflow-hidden">
            <div className="p-6 border-b border-surface-container-low flex items-center justify-between gap-3">
              <h3 className="text-lg font-extrabold text-primary font-headline flex items-center gap-2">
                <span className="material-symbols-outlined">history</span>
                الرحلات الأخيرة
              </h3>
              <button
                type="button"
                onClick={() => setShowAllTrips((prev) => !prev)}
                className="text-sm font-bold text-secondary hover:underline"
              >
                {showAllTrips ? 'عرض أحدث الرحلات' : 'عرض السجل الكامل'}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead className="bg-surface text-on-surface-variant text-sm">
                  <tr>
                    <th className="px-6 py-4 font-bold">التاريخ</th>
                    <th className="px-6 py-4 font-bold">المسار (من - إلى)</th>
                    <th className="px-6 py-4 font-bold text-center">الأجرة</th>
                    <th className="px-6 py-4 font-bold">تقييم الراكب</th>
                    <th className="px-6 py-4 font-bold">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container text-sm">
                  {visibleTrips.map((trip) => (
                    <tr key={trip.id} className="hover:bg-surface/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-on-surface font-medium">{trip.date}</div>
                        <div className="text-xs text-on-surface-variant">{trip.time}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-on-surface font-medium">{trip.from}</span>
                          <span className="material-symbols-outlined text-xs text-outline">arrow_back</span>
                          <span className="text-on-surface font-medium">{trip.to}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="font-bold text-primary">{trip.fareSar} ر.س</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-amber-500 material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                          <span className="font-medium">{trip.riderRating.toFixed(1)}</span>
                          <span className="text-xs text-on-surface-variant mr-2 italic">"{trip.riderComment}"</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          type="button"
                          onClick={async () => {
                            await runAction({
                              key: `trip-${trip.id}`,
                              successMessage: `تم تحميل تفاصيل الرحلة (${trip.id}).`,
                              errorMessage: 'تعذر تحميل تفاصيل الرحلة.',
                            });
                          }}
                          disabled={isBusy(`trip-${trip.id}`)}
                          className="text-secondary text-xs font-bold hover:underline disabled:opacity-50"
                        >
                          تفاصيل
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <button
              type="button"
              onClick={async () => {
                await runAction({
                  key: 'wallet-review',
                  successMessage: 'تم تجهيز تقرير المحفظة المالية.',
                  errorMessage: 'تعذر تجهيز تقرير المحفظة.',
                });
              }}
              disabled={isBusy('wallet-review')}
              className="bg-primary-container p-6 rounded-xl flex items-center justify-between text-right group hover:shadow-lg transition-all disabled:opacity-50"
            >
              <div className="space-y-1">
                <h4 className="text-white font-extrabold text-lg">المحفظة المالية</h4>
                <p className="text-on-primary-container text-sm">مراجعة الأرباح والعمولات والمدفوعات</p>
              </div>
              <span className="h-12 w-12 bg-white/10 rounded-full flex items-center justify-center text-white group-hover:bg-white/20 transition-all">
                <span className="material-symbols-outlined">payments</span>
              </span>
            </button>

            <button
              type="button"
              onClick={async () => {
                await runAction({
                  key: 'performance-report',
                  successMessage: 'تم إنشاء تقرير الأداء الشهري.',
                  errorMessage: 'تعذر إنشاء تقرير الأداء.',
                  onSuccess: () => {
                    setTrips((prev) => [...prev].sort((a, b) => b.fareSar - a.fareSar));
                  },
                });
              }}
              disabled={isBusy('performance-report')}
              className="bg-surface-container-high p-6 rounded-xl flex items-center justify-between text-right group hover:shadow-lg transition-all disabled:opacity-50"
            >
              <div className="space-y-1">
                <h4 className="text-on-surface font-extrabold text-lg">تقرير الأداء</h4>
                <p className="text-on-surface-variant text-sm">تحليل شهري مفصل لسلوك السائق</p>
              </div>
              <span className="h-12 w-12 bg-primary/5 rounded-full flex items-center justify-center text-primary group-hover:bg-primary/10 transition-all">
                <span className="material-symbols-outlined">analytics</span>
              </span>
            </button>
          </div>

          <div className="bg-surface-container-lowest rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-extrabold text-primary font-headline">نطاق العمل المفضل</h3>
              <span className="text-sm font-medium text-on-surface-variant">بناءً على آخر 100 رحلة</span>
            </div>
            <div className="h-64 rounded-lg bg-surface relative overflow-hidden">
              <img
                alt="Driver Area Map"
                className="w-full h-full object-cover opacity-50 grayscale"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuD5LKyj8rMp7z-Okzi6Q4L1xW8NR_y-4HBkqWa1gKdo7gBFY9nkClwF8Rs2CxuO3iWArVwo0YRf3vWNSJcBudGGJR1_tfT7jjXAnZqLQGryeCILNbYeu4d-z_XqpZ8qLRWmeYra-R7n_GtTp_7l4M29wqxxtGfvC92lIq7VUveSxmJSRuokGL2s-k9SaFfT_7GkRcqBoMFEVTsUI2kAkDVTeSqBdRf5W_uUPNAq1ypFwrCuKOPk0p1NEmLBxzVufOTxwVPFtgeUbVw"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-white/90 backdrop-blur-md p-4 rounded-xl shadow-xl flex items-center gap-3">
                  <div className="p-3 bg-secondary-container rounded-full">
                    <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>location_on</span>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-on-surface">شمال الرياض</div>
                    <div className="text-xs text-on-surface-variant">المنطقة الأكثر نشاطاً للسائق</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DriverDetails;

