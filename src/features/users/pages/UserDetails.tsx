import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ActionBanner from '../../shared/components/ActionBanner';
import { useMockAction } from '../../shared/useMockAction';

interface Trip {
  id: string;
  date: string;
  routeFrom: string;
  routeTo: string;
  driverName: string;
  cost: number;
  status: 'completed' | 'canceled';
}

interface Complaint {
  id: string;
  date: string;
  category: string;
  tripId: string;
  status: 'in_review' | 'resolved' | 'pending';
}

interface Recharge {
  id: string;
  date: string;
  transactionId: string;
  amount: number;
  method: string;
  icon: string;
  status: 'completed';
}

const initialTrips: Trip[] = [
  {
    id: 't1',
    date: '١٤ مايو ٢٠٢٤',
    routeFrom: 'حي النرجس',
    routeTo: 'مطار الملك خالد',
    driverName: 'محمد العتيبي',
    cost: 75,
    status: 'completed',
  },
  {
    id: 't2',
    date: '١٢ مايو ٢٠٢٤',
    routeFrom: 'الرياض بارك',
    routeTo: 'حي الملقا',
    driverName: 'فهد الدوسري',
    cost: 32,
    status: 'completed',
  },
  {
    id: 't3',
    date: '٠٨ مايو ٢٠٢٤',
    routeFrom: 'حي الياسمين',
    routeTo: 'التحلية',
    driverName: 'عبدالله الشمري',
    cost: 45,
    status: 'canceled',
  },
  {
    id: 't4',
    date: '٠٢ مايو ٢٠٢٤',
    routeFrom: 'حي الغدير',
    routeTo: 'جامعة الملك سعود',
    driverName: 'سلمان الزهراني',
    cost: 28,
    status: 'completed',
  },
];

const initialComplaints: Complaint[] = [
  { id: '#CMP-8821', date: '١٠ مايو ٢٠٢٤', category: 'سلوك السائق', tripId: '#TRP-4421', status: 'in_review' },
  { id: '#CMP-7543', date: '٠٢ مايو ٢٠٢٤', category: 'مشكلة في التطبيق', tripId: '#TRP-3982', status: 'resolved' },
  { id: '#CMP-6210', date: '٢٠ أبريل ٢٠٢٤', category: 'خلاف على السعر', tripId: '#TRP-2105', status: 'pending' },
];

const initialRecharges: Recharge[] = [
  { id: 'r1', date: '١٥ مايو ٢٠٢٤', transactionId: '#TXN-49210', amount: 100, method: 'بطاقة ائتمان (Visa)', icon: 'credit_card', status: 'completed' },
  { id: 'r2', date: '١٠ مايو ٢٠٢٤', transactionId: '#TXN-48765', amount: 50, method: 'Apple Pay', icon: 'apple', status: 'completed' },
  { id: 'r3', date: '٠١ مايو ٢٠٢٤', transactionId: '#TXN-47120', amount: 200, method: 'إيداع نقدي', icon: 'payments', status: 'completed' },
];

const monthlyTrips = [12, 18, 15, 22, 13, 20];
const monthLabels = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو'];

const UserDetails: React.FC = () => {
  const { i18n } = useTranslation();
  const { userId } = useParams();
  const navigate = useNavigate();
  const { runAction, isBusy, feedback, clearFeedback } = useMockAction();

  const [isFrozen, setIsFrozen] = useState(false);
  const [isVerified, setIsVerified] = useState(true);
  const [walletBalance, setWalletBalance] = useState(125);
  const [trips] = useState<Trip[]>(initialTrips);
  const [complaints, setComplaints] = useState<Complaint[]>(initialComplaints);
  const [recharges, setRecharges] = useState<Recharge[]>(initialRecharges);
  const [showAllTrips, setShowAllTrips] = useState(false);
  const [complaintFilter, setComplaintFilter] = useState<'all' | 'in_review'>('all');

  const isRtl = i18n.language.startsWith('ar');

  const visibleTrips = useMemo(() => (showAllTrips ? trips : trips.slice(0, 3)), [showAllTrips, trips]);
  const visibleComplaints = useMemo(
    () => complaints.filter((item) => complaintFilter === 'all' || item.status === 'in_review'),
    [complaintFilter, complaints],
  );

  const totalSpent = useMemo(() => trips.reduce((sum, trip) => sum + trip.cost, 0), [trips]);

  return (
    <div className="space-y-10" dir={isRtl ? 'rtl' : 'ltr'}>
      <ActionBanner feedback={feedback} onDismiss={clearFeedback} />

      <section className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/passengers')}
          className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline"
        >
          <span className="material-symbols-outlined text-base">arrow_back</span>
          العودة إلى الركاب
        </button>
        <span className="text-xs text-on-surface-variant">User ID: {userId ?? 'N/A'}</span>
      </section>

      <section className="flex flex-col md:flex-row items-start md:items-end justify-between gap-6">
        <div className="flex items-center gap-6">
          <div className="relative">
            <div className="w-28 h-28 md:w-32 md:h-32 rounded-3xl bg-surface-container-highest overflow-hidden shadow-sm">
              <img
                className="w-full h-full object-cover"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuB5FG0RoJX7-JH5zmgWTbJe33l1lv8-mtipKcZ_fBmrtAVUVQtVM4pID-AxdEIZsfvfBU9FkIXxfJzsbZslq8BRnEvAPwucu4cor4KBV_QAfnuVTneoeW20njn0FUFXwXmbM_3u-HHBZ7T0_NqOD7MdjQXpuWl0liS46F_e-RxsHEMtlzXFs5x1FN8Bn_T51H165CVPPzaEwS7ND3qPap1SVs4zsQF4ZZNW88swP74fGd27ckAquPYl70iNvxgfhOkLxh7n8CzXfEo"
                alt="Passenger"
              />
            </div>
            <div className="absolute -bottom-2 -right-2 bg-secondary text-white text-[10px] px-3 py-1 rounded-full font-bold">
              {isFrozen ? 'مجمّد' : 'نشط'}
            </div>
          </div>
          <div className="space-y-1 text-right">
            <h2 className="text-3xl md:text-4xl font-extrabold text-primary font-headline">سارة أحمد الهاشمي</h2>
            <div className="flex flex-wrap items-center gap-4 text-on-surface-variant font-medium">
              <span className="flex items-center gap-1.5"><span className="material-symbols-outlined text-sm">calendar_today</span>انضم في مارس ٢٠٢٣</span>
              <button
                type="button"
                onClick={() => setIsVerified((prev) => !prev)}
                className="flex items-center gap-1.5 hover:text-on-surface transition-colors"
              >
                <span className="material-symbols-outlined text-sm">verified</span>
                {isVerified ? 'حساب موثق' : 'غير موثق'}
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={async () => {
              await runAction({
                key: 'wallet-topup',
                successMessage: 'تم شحن المحفظة بمبلغ 50 ر.س.',
                errorMessage: 'تعذر شحن المحفظة.',
                onSuccess: () => {
                  const amount = 50;
                  setWalletBalance((prev) => prev + amount);
                  setRecharges((prev) => [{
                    id: `r-${Date.now()}`,
                    date: '٢٠ أبريل ٢٠٢٦',
                    transactionId: `#TXN-${Date.now().toString().slice(-5)}`,
                    amount,
                    method: 'بطاقة ائتمان (Visa)',
                    icon: 'credit_card',
                    status: 'completed',
                  }, ...prev]);
                },
              });
            }}
            disabled={isBusy('wallet-topup')}
            className="bg-primary-container text-white px-6 py-2.5 rounded-lg font-bold hover:opacity-90 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-lg">add_card</span>
            {isBusy('wallet-topup') ? 'جاري الشحن...' : 'شحن المحفظة'}
          </button>

          <button
            type="button"
            onClick={async () => {
              await runAction({
                key: 'message-passenger',
                successMessage: 'تم إرسال الرسالة للراكب.',
                errorMessage: 'تعذر إرسال الرسالة.',
              });
            }}
            disabled={isBusy('message-passenger')}
            className="bg-surface-container-lowest text-on-surface px-6 py-2.5 rounded-lg font-bold border border-outline-variant/20 hover:bg-surface-container-high transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-lg">mail</span>
            مراسلة الراكب
          </button>

          <button
            type="button"
            onClick={async () => {
              await runAction({
                key: 'edit-user-profile',
                successMessage: 'تم فتح وضع تعديل الراكب.',
                errorMessage: 'تعذر فتح وضع التعديل.',
              });
            }}
            disabled={isBusy('edit-user-profile')}
            className="bg-surface-container-lowest text-on-surface px-6 py-2.5 rounded-lg font-bold border border-outline-variant/20 hover:bg-surface-container-high transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-lg">edit</span>
            تعديل
          </button>

          <button
            type="button"
            onClick={async () => {
              await runAction({
                key: 'freeze-user-account',
                successMessage: isFrozen ? 'تم إلغاء تجميد الحساب.' : 'تم تجميد الحساب.',
                errorMessage: 'تعذر تحديث حالة الحساب.',
                onSuccess: () => setIsFrozen((prev) => !prev),
              });
            }}
            disabled={isBusy('freeze-user-account')}
            className="bg-error-container text-on-error-container px-6 py-2.5 rounded-lg font-bold hover:opacity-90 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-lg">block</span>
            {isFrozen ? 'إلغاء التجميد' : 'تجميد الحساب'}
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/10">
          <p className="text-sm font-medium text-on-surface-variant mb-2">إجمالي الرحلات</p>
          <div className="flex items-end justify-between">
            <h3 className="text-3xl font-extrabold text-primary">{trips.length.toLocaleString('ar-SA')}</h3>
            <span className="material-symbols-outlined text-secondary text-3xl opacity-40">route</span>
          </div>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/10">
          <p className="text-sm font-medium text-on-surface-variant mb-2">إجمالي الإنفاق</p>
          <div className="flex items-end justify-between">
            <h3 className="text-3xl font-extrabold text-primary">{totalSpent.toLocaleString('ar-SA')} ر.س</h3>
            <span className="material-symbols-outlined text-secondary text-3xl opacity-40">payments</span>
          </div>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/10">
          <p className="text-sm font-medium text-on-surface-variant mb-2">متوسط التقييم</p>
          <div className="flex items-end justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-3xl font-extrabold text-primary">٤.٩</h3>
              <span className="material-symbols-outlined text-yellow-500" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
            </div>
            <span className="material-symbols-outlined text-secondary text-3xl opacity-40">thumb_up</span>
          </div>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/10">
          <p className="text-sm font-medium text-on-surface-variant mb-2">رصيد المحفظة</p>
          <div className="flex items-end justify-between">
            <h3 className="text-3xl font-extrabold text-primary">{walletBalance.toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س</h3>
            <span className="material-symbols-outlined text-secondary text-3xl opacity-40">account_balance_wallet</span>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-10">
          <div className="bg-surface-container-lowest p-8 rounded-[2rem] border border-outline-variant/10">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h4 className="text-xl font-bold text-on-surface">إحصائيات الرحلات الشهرية</h4>
                <p className="text-sm text-on-surface-variant">تحليل نشاط الراكب خلال الـ ٦ أشهر الماضية</p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await runAction({
                    key: 'refresh-monthly-stats',
                    successMessage: 'تم تحديث الإحصائيات الشهرية.',
                    errorMessage: 'تعذر تحديث الإحصائيات.',
                  });
                }}
                disabled={isBusy('refresh-monthly-stats')}
                className="bg-surface-container-low px-4 py-2 rounded-full text-xs font-bold text-on-surface-variant hover:bg-surface-container-high disabled:opacity-50"
              >
                ٢٠٢٤
              </button>
            </div>

            <div className="h-64 flex items-end justify-between gap-4 px-4">
              {monthlyTrips.map((height, idx) => (
                <div key={monthLabels[idx]} className="flex-1 flex flex-col items-center gap-3 group">
                  <div className="w-full bg-surface-container-high rounded-full h-56 relative overflow-hidden">
                    <div
                      className="absolute bottom-0 w-full bg-secondary-container transition-all duration-500"
                      style={{ height: `${Math.min(100, height * 4)}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-on-surface-variant">{monthLabels[idx]}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h4 className="text-2xl font-bold text-primary">الرحلات الأخيرة</h4>
              <button
                type="button"
                onClick={() => setShowAllTrips((prev) => !prev)}
                className="text-secondary font-bold hover:underline"
              >
                {showAllTrips ? 'عرض الأحدث' : 'عرض الكل'}
              </button>
            </div>
            <div className="bg-surface-container-lowest rounded-[2rem] overflow-hidden border border-outline-variant/10">
              <table className="w-full text-right">
                <thead className="bg-surface-container-low text-on-surface-variant text-sm font-bold">
                  <tr>
                    <th className="px-8 py-4">التاريخ</th>
                    <th className="px-8 py-4">المسار</th>
                    <th className="px-8 py-4">السائق</th>
                    <th className="px-8 py-4">التكلفة</th>
                    <th className="px-8 py-4">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-low text-sm">
                  {visibleTrips.map((trip) => (
                    <tr key={trip.id} className="hover:bg-surface-container-low/50 transition-colors">
                      <td className="px-8 py-6 font-medium">{trip.date}</td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-2 font-bold">
                          <span>{trip.routeFrom}</span>
                          <span className="material-symbols-outlined text-xs text-secondary">arrow_back</span>
                          <span>{trip.routeTo}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6">{trip.driverName}</td>
                      <td className="px-8 py-6 font-bold">{trip.cost.toLocaleString('ar-SA')} ر.س</td>
                      <td className="px-8 py-6">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${trip.status === 'completed' ? 'bg-tertiary-fixed text-on-tertiary-fixed-variant' : 'bg-error-container text-on-error-container'}`}>
                          {trip.status === 'completed' ? 'مكتملة' : 'ملغاة'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h4 className="text-2xl font-bold text-primary">الشكاوى والبلاغات</h4>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setComplaintFilter('all')}
                  className={`text-xs font-bold px-4 py-2 rounded-full border ${complaintFilter === 'all' ? 'bg-surface-container-lowest border-outline-variant/15 text-primary' : 'text-on-surface-variant bg-transparent'}`}
                >
                  الكل
                </button>
                <button
                  type="button"
                  onClick={() => setComplaintFilter('in_review')}
                  className={`text-xs font-bold px-4 py-2 rounded-full ${complaintFilter === 'in_review' ? 'bg-surface-container-lowest border border-outline-variant/15 text-primary' : 'text-on-surface-variant bg-transparent'}`}
                >
                  قيد المعالجة
                </button>
              </div>
            </div>

            <div className="bg-surface-container-lowest rounded-[2rem] overflow-hidden border border-outline-variant/10">
              <table className="w-full text-right">
                <thead className="bg-surface-container-low text-on-surface-variant text-sm font-bold">
                  <tr>
                    <th className="px-8 py-4">رقم الشكوى</th>
                    <th className="px-8 py-4">التاريخ</th>
                    <th className="px-8 py-4">الفئة</th>
                    <th className="px-8 py-4">رقم الرحلة</th>
                    <th className="px-8 py-4">الحالة</th>
                    <th className="px-8 py-4 text-left">الإجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-low text-sm">
                  {visibleComplaints.map((item) => (
                    <tr key={item.id} className="hover:bg-surface-container-low/50 transition-colors">
                      <td className="px-8 py-6 font-bold">{item.id}</td>
                      <td className="px-8 py-6 font-medium">{item.date}</td>
                      <td className="px-8 py-6">{item.category}</td>
                      <td className="px-8 py-6"><span className="text-secondary font-bold">{item.tripId}</span></td>
                      <td className="px-8 py-6">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${item.status === 'in_review' ? 'bg-yellow-100 text-yellow-800' : item.status === 'resolved' ? 'bg-tertiary-fixed text-on-tertiary-fixed-variant' : 'bg-surface-container-high text-on-surface-variant'}`}>
                          {item.status === 'in_review' ? 'قيد المراجعة' : item.status === 'resolved' ? 'تم الحل' : 'معلقة'}
                        </span>
                      </td>
                      <td className="px-8 py-6 text-left">
                        <button
                          type="button"
                          onClick={async () => {
                            await runAction({
                              key: `refund-${item.id}`,
                              successMessage: `تم تنفيذ استرداد للشكوى ${item.id}.`,
                              errorMessage: 'تعذر تنفيذ الاسترداد.',
                              onSuccess: () => {
                                setComplaints((prev) => prev.map((entry) => {
                                  if (entry.id !== item.id) {
                                    return entry;
                                  }
                                  return { ...entry, status: 'resolved' };
                                }));
                              },
                            });
                          }}
                          disabled={isBusy(`refund-${item.id}`)}
                          className="text-primary font-bold text-xs inline-flex items-center gap-1 justify-end w-full mb-1 opacity-80 hover:opacity-100 disabled:opacity-50"
                        >
                          <span>استرداد</span>
                          <span className="material-symbols-outlined text-xs">payments</span>
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await runAction({
                              key: `complaint-${item.id}`,
                              successMessage: `تم فتح تفاصيل الشكوى ${item.id}.`,
                              errorMessage: 'تعذر فتح تفاصيل الشكوى.',
                            });
                          }}
                          disabled={isBusy(`complaint-${item.id}`)}
                          className="text-primary font-bold text-xs inline-flex items-center gap-1 justify-end w-full disabled:opacity-50"
                        >
                          <span>عرض التفاصيل</span>
                          <span className="material-symbols-outlined text-xs">chevron_left</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h4 className="text-2xl font-bold text-primary">سجل شحن المحفظة</h4>
              <button
                type="button"
                onClick={async () => {
                  await runAction({
                    key: 'export-wallet-history',
                    successMessage: 'تم تجهيز ملف تصدير سجل الشحن.',
                    errorMessage: 'تعذر تصدير سجل الشحن.',
                  });
                }}
                disabled={isBusy('export-wallet-history')}
                className="text-secondary font-bold hover:underline disabled:opacity-50"
              >
                تصدير السجل
              </button>
            </div>

            <div className="bg-surface-container-lowest rounded-[2rem] overflow-hidden border border-outline-variant/10">
              <table className="w-full text-right">
                <thead className="bg-surface-container-low text-on-surface-variant text-sm font-bold">
                  <tr>
                    <th className="px-8 py-4">التاريخ</th>
                    <th className="px-8 py-4">رقم المعاملة</th>
                    <th className="px-8 py-4">المبلغ</th>
                    <th className="px-8 py-4">طريقة الدفع</th>
                    <th className="px-8 py-4">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-low text-sm">
                  {recharges.map((entry) => (
                    <tr key={entry.id} className="hover:bg-surface-container-low/50 transition-colors">
                      <td className="px-8 py-6 font-medium">{entry.date}</td>
                      <td className="px-8 py-6 font-bold">{entry.transactionId}</td>
                      <td className="px-8 py-6 font-bold">{entry.amount.toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س</td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-2">
                          <span className={`material-symbols-outlined text-sm ${entry.icon === 'credit_card' ? 'text-blue-600' : entry.icon === 'apple' ? 'text-black' : 'text-secondary'}`}>{entry.icon}</span>
                          <span>{entry.method}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <span className="bg-tertiary-fixed text-on-tertiary-fixed-variant px-3 py-1 rounded-full text-xs font-bold">مكتملة</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-surface-container-lowest p-8 rounded-[2rem] border border-outline-variant/10 space-y-8">
            <h4 className="text-xl font-bold text-primary">معلومات الحساب</h4>
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="bg-surface-container-low p-3 rounded-2xl"><span className="material-symbols-outlined text-secondary">phone_iphone</span></div>
                <div>
                  <p className="text-xs text-on-surface-variant font-bold mb-1">رقم الجوال</p>
                  <p className="text-sm font-bold text-on-surface" dir="ltr">+966 55 123 4567</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="bg-surface-container-low p-3 rounded-2xl"><span className="material-symbols-outlined text-secondary">mail_outline</span></div>
                <div>
                  <p className="text-xs text-on-surface-variant font-bold mb-1">البريد الإلكتروني</p>
                  <p className="text-sm font-bold text-on-surface">sara.h@example.com</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="bg-surface-container-low p-3 rounded-2xl"><span className="material-symbols-outlined text-secondary">location_on</span></div>
                <div>
                  <p className="text-xs text-on-surface-variant font-bold mb-1">المنطقة المفضلة</p>
                  <p className="text-sm font-bold text-on-surface">شمال الرياض، حي الملقا</p>
                </div>
              </div>
            </div>

            <hr className="border-surface-container" />
            <div>
              <h5 className="text-sm font-extrabold text-on-surface-variant mb-4">طرق الدفع المفضلة</h5>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 bg-surface-container-low rounded-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-6 bg-white rounded flex items-center justify-center border border-outline-variant/20">
                      <span className="text-[8px] font-bold text-blue-800">VISA</span>
                    </div>
                    <span className="text-sm font-bold">**** ٤٤٣٢</span>
                  </div>
                  <span className="bg-secondary/10 text-secondary text-[10px] px-2 py-0.5 rounded font-bold">الرئيسية</span>
                </div>
                <div className="flex items-center justify-between p-4 bg-surface-container-low rounded-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-6 bg-white rounded flex items-center justify-center border border-outline-variant/20">
                      <span className="text-[8px] font-bold text-orange-600">mada</span>
                    </div>
                    <span className="text-sm font-bold">**** ٩٨٧٦</span>
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 bg-surface-container-low rounded-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-6 bg-white rounded flex items-center justify-center border border-outline-variant/20">
                      <span className="material-symbols-outlined text-sm">payments</span>
                    </div>
                    <span className="text-sm font-bold">دفع نقدي</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-surface-container-lowest rounded-[2rem] overflow-hidden border border-outline-variant/10 h-64 relative group">
            <img
              className="w-full h-full object-cover"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuBAV1o2VlQgop4Vz3MAfS8M4N5zYcEPhPU_NT4RAXFrgWljBL-KjefgfxRClJhU-AuYs-gCgX1mgohaQUc-H0pVfwKGHx3as8Zhlns9wKkCyaoQJ3vytbi3fMtqd1ObwVSTfTwZL7H1_CrAp0Xm7IK6NykolBF80whvWLkUryj3qERBYZ1gxmYzLPLxJOeoTBefhwdY8cn2NhqGWi8QHEpFf8DUn74ahDPYe0oIoZ75VmiJH0zv4tPNp32HCKw5U7pMj2kLaWpWlPY"
              alt="Map Snapshot"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-primary/80 to-transparent" />
            <div className="absolute bottom-6 right-6 text-right">
              <p className="text-white font-bold text-lg">آخر موقع للركوب</p>
              <p className="text-secondary-container text-sm">مجمع الرياض جاليري</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserDetails;

