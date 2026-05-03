# Quick Start Guide - API Integration

## 🚀 Get Started in 5 Minutes

### Step 1: Start Your Backend
Ensure your Laravel backend is running at:
```
http://localhost/4th_year_project/public/api
```

Or update `.env.local`:
```
VITE_API_BASE_URL=http://your-backend-url/api
```

### Step 2: Start the Development Server
```bash
npm run dev
```

### Step 3: Login with Demo Credentials
- **Email**: `primary@admin.com`
- **Password**: `admin_password`

### Step 4: Explore the Dashboard
The dashboard automatically loads real data from your backend!

---

## 📚 API Quick Reference

### Authentication
```typescript
import { authApi } from '@/features/auth/api/authApi';

// Login
const response = await authApi.login({
  email: 'primary@admin.com',
  password: 'admin_password'
});
// Automatically saves tokens

// Logout
await authApi.logout();
// Clears tokens automatically
```

### Dashboard Data
```typescript
import { dashboardApi } from '@/features/dashboard/api/dashboardApi';

// Get all dashboard data at once
const data = await dashboardApi.getFullDashboard();

// Or get individual widgets
const stats = await dashboardApi.getStats();
const growth = await dashboardApi.getGrowthChart(6);
const cities = await dashboardApi.getCityDistribution();
const activities = await dashboardApi.getRecentActivities(10);
```

### Wallet Management
```typescript
import { walletApi } from '@/features/wallet/api/walletApi';

const myWallet = await walletApi.getMyWallet();
const allWallets = await walletApi.getAllWallets();
await walletApi.chargeUserWallet('0912345678', 50000);
```

### Financial Reports
```typescript
import { reportsApi } from '@/features/reports/api/reportsApi';

const report = await reportsApi.generateFinancialReport(
  '2025-01-01', 
  '2025-04-30'
);
```

### User Verifications
```typescript
import { verificationsApi } from '@/features/verification/api/verificationsApi';

const pending = await verificationsApi.listPendingVerifications();
await verificationsApi.approveVerification(userId);
await verificationsApi.rejectVerification(userId);
```

---

## 🎯 What's Implemented

✅ **Authentication** (3 endpoints)
- Login, Refresh Token, Logout

✅ **Dashboard** (5 endpoints)
- Full dashboard, Stats, Growth chart, City distribution, Recent activities

✅ **Wallet** (4 endpoints)
- Get wallet, Get all wallets, Charge wallet, Transaction history

✅ **Reports** (2 endpoints)
- Generate report, Export to PDF

✅ **Verifications** (3 endpoints)
- List pending, Approve, Reject

---

## 🔧 Common Tasks

### Display Loading State
```typescript
const [isLoading, setIsLoading] = useState(true);

useEffect(() => {
  dashboardApi.getFullDashboard()
    .then(data => setData(data))
    .catch(err => setError(err))
    .finally(() => setIsLoading(false));
}, []);

if (isLoading) return <div>Loading...</div>;
```

### Handle Errors
```typescript
try {
  const data = await dashboardApi.getStats();
} catch (error: any) {
  if (error.response?.status === 401) {
    // User will be auto-redirected to login
  } else if (error.response?.status === 422) {
    // Validation error
    console.log(error.response.data.errors);
  } else {
    console.log(error.response?.data?.message);
  }
}
```

### Use with useEffect
```typescript
useEffect(() => {
  const fetchData = async () => {
    try {
      const response = await dashboardApi.getFullDashboard();
      setDashboardData(response.data);
    } catch (err) {
      setError(err.message);
    }
  };
  
  fetchData();
}, []); // Run once on mount
```

---

## 📂 File Locations

| Feature | API File | Types |
|---------|----------|-------|
| Auth | `src/features/auth/api/authApi.ts` | `src/features/auth/types.ts` |
| Dashboard | `src/features/dashboard/api/dashboardApi.ts` | `src/types/index.ts` |
| Wallet | `src/features/wallet/api/walletApi.ts` | In file |
| Reports | `src/features/reports/api/reportsApi.ts` | In file |
| Verification | `src/features/verification/api/verificationsApi.ts` | In file |

---

## 🛡️ Token Management

**Good news**: You don't need to manage tokens manually!

✅ Tokens are automatically:
- Saved to localStorage after login
- Added to all API requests
- Refreshed when expired
- Cleared on logout or 401 error
- Removed if refresh fails

---

## ⚙️ Environment Setup

### Development
```bash
npm run dev
```

### Build
```bash
npm run build
```

### Type Check
```bash
tsc -b
```

### Lint
```bash
npm run lint
```

---

## 🐛 Troubleshooting

### "401 Unauthorized" Error
✅ Token is automatically refreshed
✅ If still failing, user is redirected to login

### "Cannot POST /admin/login"
Check that your backend is running at:
```
http://localhost/4th_year_project/public/api
```

### Cannot find module errors
Run:
```bash
npm install
```

### Data not updating
Make sure to use the full dashboard endpoint:
```typescript
// ✅ Good - includes all data
const data = await dashboardApi.getFullDashboard();

// ⚠️ Only returns stats
const stats = await dashboardApi.getStats();
```

---

## 📖 Full Documentation

For detailed documentation, see:
- `API_IMPLEMENTATION_GUIDE.md` - Complete API reference
- `IMPLEMENTATION_SUMMARY.md` - What was implemented

---

## ✨ Features

✅ **Automatic Retry** - Failed requests due to expired tokens are automatically retried

✅ **Type Safety** - Full TypeScript support with proper types

✅ **Error Handling** - Consistent error handling across all endpoints

✅ **Performance** - BFF endpoint for efficient data loading

✅ **Security** - Automatic token refresh and management

✅ **Internationalization** - Arabic text fully supported

---

## 🎓 Next Steps

1. Create a new component using any API:
   ```typescript
   import { walletApi } from '@/features/wallet/api/walletApi';
   
   export const WalletCard = () => {
     const [wallet, setWallet] = useState(null);
     
     useEffect(() => {
       walletApi.getMyWallet().then(setWallet);
     }, []);
     
     return <div>{wallet?.wallet.balance}</div>;
   };
   ```

2. Add data refresh buttons to your components

3. Implement real-time updates if needed

4. Create pages for Wallet, Reports, and Verifications

---

## 💡 Pro Tips

- Use `getFullDashboard()` for the main dashboard page (loads all data at once)
- Use individual endpoints for specific widget refreshes
- Handle loading states at the component level
- Surface errors to users with helpful messages
- Consider caching data if you have lots of API calls

---

## 📞 Support

If you encounter issues:
1. Check the error message in the console
2. Verify your backend URL is correct
3. Ensure your backend credentials are right
4. Check the `API_IMPLEMENTATION_GUIDE.md` for detailed info

---

**You're all set! 🎉 Start building amazing features with real data!**

