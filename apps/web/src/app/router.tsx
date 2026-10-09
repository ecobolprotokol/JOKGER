import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { RequireAuth } from './guards/RequireAuth';
import { LoginPage } from '../features/auth/LoginPage';
import { useActiveShift } from '../features/shift';
import { strings } from '../shared/strings/id';

const ShiftPage = lazy(() =>
  import('../features/shift/ShiftPage').then((module) => ({ default: module.ShiftPage })),
);
const ChangePasswordPage = lazy(() =>
  import('../features/auth/ChangePasswordPage').then((module) => ({
    default: module.ChangePasswordPage,
  })),
);
const OrdersPage = lazy(() =>
  import('../features/orders/OrdersPage').then((module) => ({ default: module.OrdersPage })),
);
const InventoryPage = lazy(() =>
  import('../features/inventory/InventoryPage').then((module) => ({
    default: module.InventoryPage,
  })),
);
const MenuPage = lazy(() =>
  import('../features/menu/MenuPage').then((module) => ({ default: module.MenuPage })),
);
const VouchersPage = lazy(() =>
  import('../features/vouchers/VouchersPage').then((module) => ({ default: module.VouchersPage })),
);
const PaymentVerificationPage = lazy(() =>
  import('../features/payment-verification/PaymentVerificationPage').then((module) => ({
    default: module.PaymentVerificationPage,
  })),
);
const PaymentAccountsPage = lazy(() =>
  import('../features/payment-accounts/PaymentAccountsPage').then((module) => ({
    default: module.PaymentAccountsPage,
  })),
);
const PosPage = lazy(() =>
  import('../features/pos/PosPage').then((module) => ({ default: module.PosPage })),
);

function HomeRedirect() {
  const shift = useActiveShift();
  if (shift.isPending) {
    return (
      <main className="page-state" role="status">
        {strings.app.loading}
      </main>
    );
  }
  if (shift.isError) {
    return (
      <main className="page-state" role="alert">
        <h1>{strings.shift.loadError}</h1>
      </main>
    );
  }
  return <Navigate to={shift.data ? '/pos' : '/shift'} replace />;
}

function NotFoundPage() {
  return (
    <main className="full-screen-state">
      <h1>{strings.errors.NOT_FOUND}</h1>
      <a className="button button--primary" href="/shift">
        {strings.errors.backToShift}
      </a>
    </main>
  );
}

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <RequireAuth>
        <HomeRedirect />
      </RequireAuth>
    ),
  },
  {
    path: '/pos',
    element: (
      <RequireAuth>
        <Suspense
          fallback={
            <main className="page-state" role="status">
              {strings.app.loading}
            </main>
          }
        >
          <PosPage />
        </Suspense>
      </RequireAuth>
    ),
  },
  {
    path: '/shift',
    element: (
      <RequireAuth>
        <Suspense
          fallback={
            <main className="page-state" role="status">
              {strings.app.loading}
            </main>
          }
        >
          <ShiftPage />
        </Suspense>
      </RequireAuth>
    ),
  },
  {
    path: '/account/password',
    element: (
      <RequireAuth>
        <Suspense
          fallback={
            <main className="page-state" role="status">
              {strings.app.loading}
            </main>
          }
        >
          <ChangePasswordPage />
        </Suspense>
      </RequireAuth>
    ),
  },
  {
    path: '/orders',
    element: (
      <RequireAuth>
        <Suspense
          fallback={
            <main className="page-state" role="status">
              {strings.app.loading}
            </main>
          }
        >
          <OrdersPage />
        </Suspense>
      </RequireAuth>
    ),
  },
  {
    path: '/inventory',
    element: (
      <RequireAuth>
        <Suspense
          fallback={
            <main className="page-state" role="status">
              {strings.app.loading}
            </main>
          }
        >
          <InventoryPage />
        </Suspense>
      </RequireAuth>
    ),
  },
  {
    path: '/menu',
    element: (
      <RequireAuth>
        <Suspense
          fallback={
            <main className="page-state" role="status">
              {strings.app.loading}
            </main>
          }
        >
          <MenuPage />
        </Suspense>
      </RequireAuth>
    ),
  },
  {
    path: '/vouchers',
    element: (
      <RequireAuth>
        <Suspense
          fallback={
            <main className="page-state" role="status">
              {strings.app.loading}
            </main>
          }
        >
          <VouchersPage />
        </Suspense>
      </RequireAuth>
    ),
  },
  {
    path: '/payment-verification',
    element: (
      <RequireAuth>
        <Suspense
          fallback={
            <main className="page-state" role="status">
              {strings.app.loading}
            </main>
          }
        >
          <PaymentVerificationPage />
        </Suspense>
      </RequireAuth>
    ),
  },
  {
    path: '/payment-accounts',
    element: (
      <RequireAuth>
        <Suspense
          fallback={
            <main className="page-state" role="status">
              {strings.app.loading}
            </main>
          }
        >
          <PaymentAccountsPage />
        </Suspense>
      </RequireAuth>
    ),
  },
  {
    path: '/403',
    element: (
      <main className="full-screen-state">
        <h1>{strings.errors.forbiddenTitle}</h1>
        <a className="button button--primary" href="/shift">
          {strings.errors.backToShift}
        </a>
      </main>
    ),
  },
  { path: '*', element: <NotFoundPage /> },
]);
