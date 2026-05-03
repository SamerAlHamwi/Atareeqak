# SyRide Admin Dashboard API Implementation Guide

This document explains how to use the implemented APIs from the backend collection in your React application.

## Table of Contents
1. [Authentication APIs](#authentication-apis)
2. [Dashboard APIs](#dashboard-apis)
3. [Wallet APIs](#wallet-apis)
4. [Reports APIs](#reports-apis)
5. [Verification APIs](#verification-apis)
6. [Error Handling](#error-handling)
7. [Configuration](#configuration)

---

## Authentication APIs

Located in: `src/features/auth/api/authApi.ts`

### Login
```typescript
import { authApi } from '@/features/auth/api/authApi';

const response = await authApi.login({
  email: 'primary@admin.com',
  password: 'admin_password'
});

// Response
{
  status: 'success',
  message: 'Login successful',
  admin: {
    type: 'primary',
    email: 'primary@admin.com',
    name: 'Admin Name',
    phone: '+963999999999'
  },
  tokens: {
    access_token: '<jwt_access_token>',
    refresh_token: '<jwt_refresh_token>',
    token_type: 'Bearer',
    expires_in: 3600
  }
}
```

**Usage in Login.tsx:**
```typescript
try {
  const response = await authApi.login({ email, password });
  if (response.status === 'success') {
    login(userData, response.tokens.access_token, response.tokens.refresh_token);
    navigate('/dashboard');
  }
} catch (error) {
  setError(error.response?.data?.message);
}
```

### Refresh Token
```typescript
const response = await authApi.refresh(refreshToken);

// Gets new access and optionally new refresh tokens
```

### Logout
```typescript
await authApi.logout();
// Automatically clears tokens and redirects to login if needed
```

---

## Dashboard APIs

Located in: `src/features/dashboard/api/dashboardApi.ts`

### Get Full Dashboard (All Widgets)
```typescript
import { dashboardApi } from '@/features/dashboard/api/dashboardApi';

const response = await dashboardApi.getFullDashboard();

// Response includes:
{
  status: 'success',
  data: {
    stats: { /* KPI data */ },
    growth_chart: { /* Chart data */ },
    city_distribution: [ /* City data */ ],
    recent_activities: [ /* Activities */ ]
  }
}
```

### Get Stats Only (KPI Cards)
```typescript
const response = await dashboardApi.getStats();

// Response
{
  status: 'success',
  data: {
    total_users: 1250,
    active_trips: 47,
    completed_trips: 3840,
    total_revenue: { 
      raw: 18500000, 
      formatted: '185,000.00 SYP' 
    },
    pending_complaints: 0,
    verification_requests: 12
  }
}
```

### Get Growth Chart Data
```typescript
const response = await dashboardApi.getGrowthChart(6); // Last 6 months

// Response
{
  status: 'success',
  data: {
    period: 'last_6_months',
    data: [
      { 
        month: 'Nov', 
        label: 'Nov 2024', 
        completed_trips: 580, 
        new_users: 120 
      },
      // ... more months
    ]
  }
}
```

### Get City Distribution
```typescript
const response = await dashboardApi.getCityDistribution();

// Response
{
  status: 'success',
  data: [
    { 
      city: 'دمشق', 
      city_en: 'Damascus', 
      count: 450, 
      percentage: 45 
    },
    // ... more cities
  ]
}
```

### Get Recent Activities
```typescript
const response = await dashboardApi.getRecentActivities(10); // Last 10 activities

// Response
{
  status: 'success',
  data: [
    {
      booking_id: 101,
      user: { name: 'Ahmad Khalil', number: 'XXX-XXX-1234' },
      driver: 'Samer Ali',
      route: 'دمشق ← حلب',
      date: { 
        raw: '2025-04-25T10:30:00+03:00', 
        human: 'Today, 10:30' 
      },
      status: 'completed',
      value: '5,000.00 SYP'
    }
  ]
}
```

---

## Wallet APIs

Located in: `src/features/wallet/api/walletApi.ts`

### Get My Wallet
```typescript
import { walletApi } from '@/features/wallet/api/walletApi';

const response = await walletApi.getMyWallet();

// Response
{
  status: 'success',
  wallet: {
    id: 1,
    wallet_number: '1234567890123456',
    phone_number: '+963999999999',
    balance: '500,000.00 SYP',
    admin_type: 'primary'
  }
}
```

### Get All Wallets
```typescript
const response = await walletApi.getAllWallets();

// Response includes both admin and user wallets
```

### Charge User Wallet (Primary Admin Only)
```typescript
const response = await walletApi.chargeUserWallet(
  '0912345678',  // phone_number
  50000          // amount in SYP
);

// Response
{
  status: 'success',
  message: 'Wallet charged successfully',
  wallet: {
    phone_number: '0912345678',
    previous_balance: '10,000.00 SYP',
    new_balance: '60,000.00 SYP'
  },
  transaction_id: 'PRIMARY_1714040000_Ab3xYz'
}
```

### Get Wallet Transactions
```typescript
const response = await walletApi.getWalletTransactions(1);

// Response includes paginated transactions
```

---

## Reports APIs

Located in: `src/features/reports/api/reportsApi.ts`

### Generate Financial Report (Primary Admin Only)
```typescript
import { reportsApi } from '@/features/reports/api/reportsApi';

const response = await reportsApi.generateFinancialReport(
  '2025-01-01',  // startDate (optional)
  '2025-04-30'   // endDate (optional)
);

// Response
{
  status: 'success',
  report_data: {
    ride_stats: {
      total: 4800,
      active: 47,
      completed: 3840,
      cancelled: 720,
      awaiting_confirmation: 193
    },
    financial_stats: {
      sycash: {
        current_balance: '75,000.00 SYP',
        total_creation_fees: '240,000.00 SYP'
      },
      primary_admin: {
        current_balance: '500,000.00 SYP',
        total_collected: '18,500,000.00 SYP',
        total_disbursed: '17,900,000.00 SYP'
      },
      active_rides_locked: '100,000.00 SYP'
    },
    date_range: {
      start: '2025-01-01 00:00:00',
      end: '2025-04-30 23:59:59'
    }
  }
}
```

### Export Report to PDF
```typescript
const pdfBlob = await reportsApi.exportReportToPdf('2025-01-01', '2025-04-30');

// Download the PDF
const url = window.URL.createObjectURL(pdfBlob);
const link = document.createElement('a');
link.href = url;
link.download = 'report.pdf';
link.click();
```

---

## Verification APIs

Located in: `src/features/verification/api/verificationsApi.ts`

### List Pending Verifications (Primary Admin Only)
```typescript
import { verificationsApi } from '@/features/verification/api/verificationsApi';

const response = await verificationsApi.listPendingVerifications();

// Response
{
  status: 'success',
  data: [
    {
      user_id: 42,
      name: 'Ahmad Khalil',
      email: 'ahmad@example.com',
      type: 'driver',
      documents: [
        { type: 'face_id', url: 'http://...' },
        { type: 'back_id', url: 'http://...' },
        { type: 'license', url: 'http://...' },
        { type: 'mechanic_card', url: 'http://...' }
      ],
      submitted_at: '2025-04-24T18:00:00+03:00'
    }
  ]
}
```

### Approve Verification (Primary Admin Only)
```typescript
const response = await verificationsApi.approveVerification(42);

// Response
{
  status: 'success',
  message: 'Driver verification approved',
  user: {
    id: 42,
    verification_status: 'approved'
  }
}
```

### Reject Verification (Primary Admin Only)
```typescript
const response = await verificationsApi.rejectVerification(42);

// Response
{
  status: 'success',
  message: 'Verification rejected'
}
```

---

## Error Handling

All API calls follow a consistent error handling pattern:

```typescript
try {
  const response = await dashboardApi.getStats();
  // Use response.data
} catch (error: any) {
  if (error.response?.status === 401) {
    // Unauthorized - Token will be automatically refreshed or user redirected to login
    console.log('Session expired');
  } else if (error.response?.status === 422) {
    // Validation error
    console.log('Validation failed:', error.response.data.errors);
  } else if (error.response?.status === 404) {
    // Resource not found
    console.log('Resource not found');
  } else {
    console.log('Error:', error.response?.data?.message || error.message);
  }
}
```

### Common HTTP Status Codes:
- **200**: Success
- **401**: Unauthorized (token is invalid/expired)
- **422**: Validation failed
- **404**: Resource not found
- **500**: Server error

---

## Configuration

### API Base URL
The API base URL is configured in `src/services/api.ts`:

```typescript
baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost/4th_year_project/public/api'
```

To change it, create a `.env.local` file:
```
VITE_API_BASE_URL=http://your-api-url/api
```

### Authentication Header
The Authorization header is automatically added to all requests using the access token stored in `localStorage`:

```axios
Authorization: Bearer <access_token>
```

### Token Refresh
When a 401 response is received, the interceptor automatically attempts to refresh the token using the stored refresh token. If refresh fails, the user is redirected to the login page.

---

## Usage Examples

### Example 1: Using Dashboard Data in a Component
```typescript
import { useEffect, useState } from 'react';
import { dashboardApi } from '@/features/dashboard/api/dashboardApi';

export const MyDashboardComponent = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await dashboardApi.getFullDashboard();
        setData(response.data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h1>Total Users: {data.stats.total_users}</h1>
      <p>Active Trips: {data.stats.active_trips}</p>
    </div>
  );
};
```

### Example 2: Using Auth API for Login
```typescript
import { authApi } from '@/features/auth/api/authApi';
import { useAuth } from '@/app/context/AuthContext';

export const LoginForm = () => {
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await authApi.login({ email, password });
      login(
        response.admin,
        response.tokens.access_token,
        response.tokens.refresh_token
      );
    } catch (error) {
      console.error('Login failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      handleLogin(email, password);
    }}>
      {/* form fields */}
    </form>
  );
};
```

---

## Demo Credentials

For testing with the backend API:
- **Email**: `primary@admin.com`
- **Password**: `admin_password`

This account has full access to all features as a primary admin.

---

## Notes

1. All token management is handled automatically by the API interceptor
2. The refresh token is automatically used when the access token expires
3. If token refresh fails, the user is redirected to the login page
4. All API responses follow a consistent structure with `status` and `data` fields
5. Arabic text in responses (like city names) is fully supported
6. Currency values are provided in both raw numbers and formatted strings

