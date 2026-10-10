import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Banknote,
  ClipboardList,
  CookingPot,
  CreditCard,
  History as HistoryIcon,
  KeyRound,
  LayoutDashboard,
  Package,
  ClipboardCheck,
  ChartNoAxesCombined,
  Settings,
  Paintbrush,
  UsersRound,
  Receipt,
  Tags,
  WalletCards,
} from 'lucide-react';
import { useProfile } from '../features/auth';
import { strings } from '../shared/strings/id';

const defaultPage = { to: '/shift', label: strings.shift.title, icon: LayoutDashboard };

const navigation = [
  defaultPage,
  { to: '/pos', label: strings.pos.title, icon: Banknote },
  { to: '/pos/open-bill', label: strings.openBill.title, icon: Receipt },
  { to: '/orders', label: strings.orders.title, icon: ClipboardList },
  { to: '/history', label: strings.history.title, icon: HistoryIcon },
  { to: '/menu', label: strings.menuManagement.title, icon: CookingPot },
  { to: '/inventory', label: strings.inventory.title, icon: Package },
  { to: '/inventory/opname', label: strings.opname.title, icon: ClipboardCheck },
  { to: '/reports', label: strings.reports.title, icon: ChartNoAxesCombined },
  { to: '/settings', label: strings.settings.title, icon: Settings, superAdmin: true },
  { to: '/settings/branding', label: strings.branding.title, icon: Paintbrush, superAdmin: true },
  { to: '/settings/staff', label: strings.staff.title, icon: UsersRound, superAdmin: true },
  { to: '/vouchers', label: strings.vouchers.title, icon: Tags },
  { to: '/payment-verification', label: strings.paymentVerification.title, icon: WalletCards },
  { to: '/payment-accounts', label: strings.paymentAccounts.title, icon: CreditCard },
  { to: '/account/password', label: strings.auth.passwordChangeTitle, icon: KeyRound },
];

export function AppShell(): JSX.Element {
  const profile = useProfile();
  const location = useLocation();
  const isPos = location.pathname.startsWith('/pos');
  const isSuperAdmin = profile.data?.role === 'super_admin';
  const visibleNavigation = navigation.filter((item) => !('superAdmin' in item) || isSuperAdmin);
  const currentPage =
    visibleNavigation.find(
      (item) =>
        location.pathname === item.to ||
        (item.to !== '/shift' && location.pathname.startsWith(`${item.to}/`)),
    ) ?? defaultPage;
  const Icon = currentPage.icon;
  const displayName = profile.data?.full_name.trim() || strings.app.name;

  if (isPos) {
    return (
      <div className="app-shell app-shell--pos">
        <Outlet />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <NavLink className="app-brand" to="/shift" aria-label={strings.app.name}>
          <span className="app-brand__mark" aria-hidden="true">
            J
          </span>
          <span className="app-brand__copy">
            <strong>{strings.app.name}</strong>
            <small>{strings.app.operationTitle}</small>
          </span>
        </NavLink>

        <p className="app-nav__label">{strings.app.operationTitle}</p>
        <nav className="app-nav" aria-label={strings.app.operationTitle}>
          {visibleNavigation.map(({ to, label, icon: ItemIcon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => (isActive ? 'app-nav__link is-active' : 'app-nav__link')}
              aria-label={label}
              end={to === '/shift'}
            >
              <ItemIcon size={19} strokeWidth={1.8} aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="app-sidebar__footer">
          <span className="app-avatar" aria-hidden="true">
            {displayName.slice(0, 1).toLocaleUpperCase('id-ID')}
          </span>
          <span className="app-user-copy">
            <strong>{displayName}</strong>
            <small>{profile.data?.role === 'super_admin' ? 'Superadmin' : 'Administrator'}</small>
          </span>
        </div>
      </aside>

      <div className="app-workspace">
        <header className="app-topbar">
          <div className="app-topbar__heading">
            <span className="app-topbar__icon" aria-hidden="true">
              <Icon size={18} />
            </span>
            <div>
              <p>{strings.app.operationTitle}</p>
              <span className="app-topbar__title">{currentPage.label}</span>
            </div>
          </div>
          <div className="app-topbar__account">
            <span className="app-avatar" aria-hidden="true">
              {displayName.slice(0, 1).toLocaleUpperCase('id-ID')}
            </span>
            <span className="app-user-copy">
              <strong>{displayName}</strong>
              <small>{profile.data?.role === 'super_admin' ? 'Superadmin' : 'Administrator'}</small>
            </span>
          </div>
        </header>

        <div className="app-main">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
