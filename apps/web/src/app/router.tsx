import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { RequireAuth } from './guards/RequireAuth';
import { AppShell } from './AppShell';
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
const OrderDetailPage = lazy(() =>
  import('../features/orders/OrderDetailPage').then((module) => ({
    default: module.OrderDetailPage,
  })),
);
const HistoryPage = lazy(() =>
  import('../features/orders/HistoryPage').then((module) => ({ default: module.HistoryPage })),
);
const InventoryPage = lazy(() =>
  import('../features/inventory/InventoryPage').then((module) => ({
    default: module.InventoryPage,
  })),
);
const OpnameListPage = lazy(() =>
  import('../features/opname/OpnameListPage').then((module) => ({
    default: module.OpnameListPage,
  })),
);
const OpnameDetailPage = lazy(() =>
  import('../features/opname/OpnameDetailPage').then((module) => ({
    default: module.OpnameDetailPage,
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
const OpenBillPage = lazy(() =>
  import('../features/pos/OpenBillPage').then((module) => ({ default: module.OpenBillPage })),
);

function suspended(element: ReactNode): JSX.Element {
  return (
    <Suspense
      fallback={
        <main className="page-state" role="status">
          {strings.app.loading}
        </main>
      }
    >
      {element}
    </Suspense>
  );
}

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
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <HomeRedirect /> },
      { path: 'pos', element: suspended(<PosPage />) },
      { path: 'pos/open-bill/:orderId', element: suspended(<OpenBillPage />) },
      { path: 'shift', element: suspended(<ShiftPage />) },
      { path: 'account/password', element: suspended(<ChangePasswordPage />) },
      { path: 'orders', element: suspended(<OrdersPage />) },
      { path: 'orders/:orderId', element: suspended(<OrderDetailPage />) },
      { path: 'history', element: suspended(<HistoryPage />) },
      { path: 'inventory', element: suspended(<InventoryPage />) },
      { path: 'inventory/opname', element: suspended(<OpnameListPage />) },
      { path: 'inventory/opname/:opnameId', element: suspended(<OpnameDetailPage />) },
      { path: 'menu', element: suspended(<MenuPage />) },
      { path: 'vouchers', element: suspended(<VouchersPage />) },
      { path: 'payment-verification', element: suspended(<PaymentVerificationPage />) },
      { path: 'payment-accounts', element: suspended(<PaymentAccountsPage />) },
    ],
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
