import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { validateContrast } from '../../shared/lib/contrast';
import { ErrorState } from '../../shared/components/ErrorState';
import { PageHeader } from '../../shared/components/PageHeader';
import { supabase } from '../../shared/lib/supabase';
import { toAppError } from '../../shared/lib/errors';
import { strings } from '../../shared/strings/id';
import { useSaveStoreSettings, useStoreSettings } from './hooks';
import type { StoreSettings } from './api';

async function loadFont(font: StoreSettings['font_family']): Promise<void> {
  if (font === 'Inter') await import('@fontsource/inter/400.css');
  else if (font === 'Plus Jakarta Sans') await import('@fontsource/plus-jakarta-sans/400.css');
  else if (font === 'Poppins') await import('@fontsource/poppins/400.css');
}

function jakartaDatePath(date = new Date()): string {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'Asia/Jakarta',
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  return `${values.year}/${values.month}/${values.day}`;
}

async function validImage(file: File): Promise<boolean> {
  if (file.size > 1_048_576) return false;
  if (file.type === 'image/png') {
    const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());
    return bytes.join(',') === '137,80,78,71,13,10,26,10';
  }
  if (file.type === 'image/jpeg') {
    const bytes = new Uint8Array(await file.slice(0, 3).arrayBuffer());
    return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  }
  if (file.type === 'image/webp') {
    const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    return (
      new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' &&
      new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP'
    );
  }
  if (file.type === 'image/svg+xml') {
    const text = (await file.slice(0, 4096).text()).trimStart();
    return text.startsWith('<svg') || (text.startsWith('<?xml') && text.includes('<svg'));
  }
  return false;
}

export function BrandingPage(): JSX.Element {
  const query = useStoreSettings();
  const save = useSaveStoreSettings();
  const [form, setForm] = useState<StoreSettings | null>(null);
  const [uploading, setUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (query.data) setForm(query.data);
  }, [query.data]);

  const primaryContrast = form ? validateContrast(form.primary_color, form.accent_color) : null;
  const accentContrast = form ? validateContrast(form.accent_color, form.primary_color) : null;
  const contrastPass = Boolean(primaryContrast?.passes && accentContrast?.passes);

  async function uploadLogo(file: File | undefined): Promise<void> {
    if (!file) return;
    setLogoError(null);
    if (!(await validImage(file))) {
      setLogoError(strings.branding.invalidLogo);
      return;
    }
    if (!supabase) {
      setLogoError(strings.common.configurationError);
      return;
    }
    const extension = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1];
    const path = `logo/${jakartaDatePath()}/${crypto.randomUUID()}.${extension}`;
    setUploading(true);
    try {
      const { error } = await supabase.storage.from('public-assets').upload(path, file, {
        cacheControl: '3600',
        contentType: file.type,
        upsert: false,
      });
      if (error) throw error;
      const { data } = supabase.storage.from('public-assets').getPublicUrl(path);
      setForm((current) => (current ? { ...current, logo_url: data.publicUrl } : current));
    } catch (error) {
      setLogoError(toAppError(error).message);
    } finally {
      setUploading(false);
    }
  }

  async function saveBranding(): Promise<void> {
    if (!form || !contrastPass) return;
    setSaveError(null);
    try {
      await loadFont(form.font_family);
      await save.mutateAsync({
        logo_url: form.logo_url,
        primary_color: form.primary_color,
        accent_color: form.accent_color,
        font_family: form.font_family,
      });
      toast.success(strings.branding.saved);
    } catch (error) {
      setSaveError(toAppError(error).message);
    }
  }

  if (query.isPending)
    return (
      <main className="page-state" role="status">
        {strings.app.loading}
      </main>
    );
  if (query.isError)
    return (
      <main className="page-state">
        <h1>{strings.branding.loadError}</h1>
        <ErrorState error={toAppError(query.error)} onRetry={() => void query.refetch()} />
      </main>
    );
  if (!form)
    return (
      <main className="page-state" role="status">
        {strings.app.loading}
      </main>
    );

  return (
    <main className="settings-page">
      <PageHeader
        title={strings.branding.title}
        actions={
          <div className="settings-page__actions">
            <button className="button button--secondary" onClick={() => setForm(query.data)}>
              {strings.branding.cancelPreview}
            </button>
            <button
              className="button button--primary"
              disabled={!contrastPass || save.isPending || uploading}
              onClick={() => void saveBranding()}
            >
              {strings.common.save}
            </button>
          </div>
        }
      />
      <section className="settings-section">
        <h2>{strings.branding.logo}</h2>
        {form.logo_url && (
          <img className="branding-logo-preview" src={form.logo_url} alt={strings.branding.logo} />
        )}
        <label className="field">
          <span>{strings.branding.uploadLogo}</span>
          <input
            type="file"
            accept="image/png,image/svg+xml,image/webp"
            onChange={(event) => void uploadLogo(event.target.files?.[0])}
          />
        </label>
        <p className="settings-hint">{strings.branding.logoHint}</p>
        {logoError && (
          <p role="alert" className="form-alert">
            {logoError}
          </p>
        )}
      </section>
      <section className="settings-section">
        <h2>
          {strings.branding.primaryColor} dan {strings.branding.accentColor}
        </h2>
        <div className="settings-grid">
          <label className="field">
            <span>{strings.branding.primaryColor}</span>
            <span className="color-field">
              <input
                type="color"
                value={form.primary_color}
                onChange={(event) => setForm({ ...form, primary_color: event.target.value })}
              />
              <input
                value={form.primary_color}
                maxLength={7}
                onChange={(event) => setForm({ ...form, primary_color: event.target.value })}
              />
            </span>
          </label>
          <label className="field">
            <span>{strings.branding.accentColor}</span>
            <span className="color-field">
              <input
                type="color"
                value={form.accent_color}
                onChange={(event) => setForm({ ...form, accent_color: event.target.value })}
              />
              <input
                value={form.accent_color}
                maxLength={7}
                onChange={(event) => setForm({ ...form, accent_color: event.target.value })}
              />
            </span>
          </label>
        </div>
        <div className="branding-contrast" role={contrastPass ? 'status' : 'alert'}>
          <span>
            {strings.branding.contrast}: {primaryContrast?.ratio.toFixed(2)}:1
          </span>
          <strong>
            {contrastPass ? strings.branding.contrastPass : strings.errors.CONTRAST_TOO_LOW}
          </strong>
        </div>
        <div
          className="branding-preview"
          style={{ backgroundColor: form.primary_color, color: '#fff' }}
        >
          <strong>{form.store_name}</strong>
          <span>{strings.branding.previewText}</span>
        </div>
      </section>
      <section className="settings-section">
        <h2>{strings.branding.font}</h2>
        <label className="field">
          <span>{strings.branding.font}</span>
          <select
            value={form.font_family}
            onChange={(event) => {
              const font = event.target.value as StoreSettings['font_family'];
              setForm({ ...form, font_family: font });
              void loadFont(font);
            }}
          >
            <option>Inter</option>
            <option>Plus Jakarta Sans</option>
            <option>Poppins</option>
            <option>system-ui</option>
          </select>
        </label>
        <p className="branding-font-preview" style={{ fontFamily: form.font_family }}>
          {strings.branding.previewText}
        </p>
      </section>
      {saveError && (
        <p role="alert" className="form-alert">
          {saveError}
        </p>
      )}
    </main>
  );
}
