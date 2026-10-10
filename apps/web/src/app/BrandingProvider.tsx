import { useEffect, type ReactNode } from 'react';
import { getContrastTextColor } from '../shared/lib/contrast';
import { useStoreSettings } from '../features/settings';
import type { StoreSettings } from '../features/settings';

const fontLoaders: Record<StoreSettings['font_family'], () => Promise<unknown>> = {
  Inter: () => import('@fontsource/inter/400.css'),
  'Plus Jakarta Sans': () => import('@fontsource/plus-jakarta-sans/400.css'),
  Poppins: () => import('@fontsource/poppins/400.css'),
  'system-ui': async () => undefined,
};

export function applyBranding(
  settings: Pick<
    StoreSettings,
    'store_name' | 'primary_color' | 'accent_color' | 'font_family' | 'logo_url'
  >,
): void {
  const root = document.documentElement;
  root.style.setProperty('--brand', settings.primary_color);
  root.style.setProperty('--accent', settings.accent_color);
  root.style.setProperty('--brand-contrast', getContrastTextColor(settings.primary_color));
  root.style.setProperty(
    '--font-family',
    settings.font_family === 'system-ui'
      ? 'system-ui, sans-serif'
      : `'${settings.font_family}', sans-serif`,
  );
  root.style.setProperty(
    '--store-logo-url',
    settings.logo_url ? `url("${settings.logo_url.replaceAll('"', '')}")` : 'none',
  );
  document.title = settings.store_name;
}

export function BrandingProvider({ children }: { children: ReactNode }): JSX.Element {
  const settings = useStoreSettings();
  useEffect(() => {
    const current = settings.data;
    if (!current) return;
    void fontLoaders[current.font_family]().then(() => applyBranding(current));
  }, [settings.data]);
  return <>{children}</>;
}
