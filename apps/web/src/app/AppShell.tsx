import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Banknote,
  ChevronDown,
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
  Printer,
  ScrollText,
  Receipt,
  Tags,
  WalletCards,
} from 'lucide-react';
import { useProfile } from '../features/auth';
import { strings } from '../shared/strings/id';

const defaultPage = { to: '/shift', label: strings.shift.title, icon: LayoutDashboard };

const navigationGroups = [
  {
    label: strings.app.navigation.operations,
    links: [
      defaultPage,
      { to: '/pos', label: strings.pos.title, icon: Banknote },
      { to: '/pos/open-bill', label: strings.openBill.title, icon: Receipt },
      { to: '/orders', label: strings.orders.title, icon: ClipboardList },
      { to: '/history', label: strings.history.title, icon: HistoryIcon },
    ],
  },
  {
    label: strings.app.navigation.catalog,
    links: [
      { to: '/menu', label: strings.menuManagement.title, icon: CookingPot },
      { to: '/inventory', label: strings.inventory.title, icon: Package },
      { to: '/inventory/opname', label: strings.opname.title, icon: ClipboardCheck },
      { to: '/vouchers', label: strings.vouchers.title, icon: Tags },
    ],
  },
  {
    label: strings.app.navigation.finance,
    links: [
      { to: '/reports', label: strings.reports.title, icon: ChartNoAxesCombined },
      { to: '/payment-verification', label: strings.paymentVerification.title, icon: WalletCards },
      { to: '/payment-accounts', label: strings.paymentAccounts.title, icon: CreditCard },
    ],
  },
  {
    label: strings.app.navigation.management,
    links: [
      { to: '/settings', label: strings.settings.title, icon: Settings, superAdmin: true },
      {
        to: '/settings/branding',
        label: strings.branding.title,
        icon: Paintbrush,
        superAdmin: true,
      },
      { to: '/settings/staff', label: strings.staff.title, icon: UsersRound, superAdmin: true },
      { to: '/settings/printer', label: strings.printer.title, icon: Printer },
      { to: '/audit', label: strings.audit.title, icon: ScrollText, superAdmin: true },
      { to: '/account/password', label: strings.auth.passwordChangeTitle, icon: KeyRound },
    ],
  },
];

function matchesPath(pathname: string, to: string): boolean {
  return pathname === to || (to !== '/shift' && pathname.startsWith(`${to}/`));
}

export function AppShell(): JSX.Element {
  const profile = useProfile();
  const location = useLocation();
  const isPos = location.pathname.startsWith('/pos');
  const isSuperAdmin = profile.data?.role === 'super_admin';
  const visibleGroups = navigationGroups
    .map((group) => ({
      ...group,
      links: group.links.filter(
        (item) => !('superAdmin' in item) || !item.superAdmin || isSuperAdmin,
      ),
    }))
    .filter((group) => group.links.length > 0);
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

        <nav className="app-nav" aria-label={strings.app.operationTitle}>
          {visibleGroups.map((group) => (
            <details
              className="app-nav-group"
              key={group.label}
              open={group.links.some((item) => matchesPath(location.pathname, item.to))}
            >
              <summary className="app-nav-group__summary">
                <span>{group.label}</span>
                <ChevronDown size={15} aria-hidden="true" />
              </summary>
              <div className="app-nav-group__items">
                {group.links.map(({ to, label, icon: ItemIcon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    className={({ isActive }) =>
                      isActive ? 'app-nav__link is-active' : 'app-nav__link'
                    }
                    aria-label={label}
                    end={to === '/shift'}
                  >
                    <ItemIcon size={17} strokeWidth={1.8} aria-hidden="true" />
                    <span>{label}</span>
                  </NavLink>
                ))}
              </div>
            </details>
          ))}
        </nav>

        <div className="app-sidebar__footer">
          <span className="app-avatar" aria-hidden="true">
            {displayName.slice(0, 1).toLocaleUpperCase('id-ID')}
          </span>
          <span className="app-user-copy">
            <strong>{displayName}</strong>
            <small>
              {profile.data?.role === 'super_admin'
                ? strings.app.roles.superAdmin
                : strings.app.roles.admin}
            </small>
          </span>
        </div>
      </aside>

      <div className="app-workspace">
        <div className="app-main">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
