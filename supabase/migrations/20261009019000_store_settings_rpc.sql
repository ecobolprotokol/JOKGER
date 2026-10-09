create function _relative_luminance(hex text)
returns numeric
language plpgsql
immutable
set search_path = public
as $$
declare
  v_red numeric;
  v_green numeric;
  v_blue numeric;
begin
  if hex is null or hex !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception using errcode = 'P0001', message = 'INPUT_INVALID';
  end if;
  v_red := get_byte(decode(substr(hex, 2, 2), 'hex'), 0) / 255.0;
  v_green := get_byte(decode(substr(hex, 4, 2), 'hex'), 0) / 255.0;
  v_blue := get_byte(decode(substr(hex, 6, 2), 'hex'), 0) / 255.0;
  v_red := case when v_red <= 0.04045 then v_red / 12.92 else power((v_red + 0.055) / 1.055, 2.4) end;
  v_green := case when v_green <= 0.04045 then v_green / 12.92 else power((v_green + 0.055) / 1.055, 2.4) end;
  v_blue := case when v_blue <= 0.04045 then v_blue / 12.92 else power((v_blue + 0.055) / 1.055, 2.4) end;
  return 0.2126 * v_red + 0.7152 * v_green + 0.0722 * v_blue;
end;
$$;

create function _contrast_ratio(a text, b text)
returns numeric
language sql
immutable
strict
set search_path = public
as $$
  select (greatest(_relative_luminance(a), _relative_luminance(b)) + 0.05)
    / (least(_relative_luminance(a), _relative_luminance(b)) + 0.05);
$$;

create function update_store_settings(p_settings jsonb)
returns store_settings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings store_settings;
  v_primary_color text;
  v_accent_color text;
begin
  if not is_super_admin() then
    raise exception using errcode = 'P0001', message = 'NOT_AUTHORIZED';
  end if;
  if p_settings is null or jsonb_typeof(p_settings) <> 'object'
    or p_settings - array[
      'store_name', 'address', 'phone', 'logo_url', 'primary_color', 'accent_color',
      'font_family', 'tax_percent', 'service_percent', 'rounding_rule', 'receipt_header',
      'receipt_footer', 'paper_width_mm', 'require_verified_payment'
    ]::text[] <> '{}'::jsonb then
    raise exception using errcode = 'P0001', message = 'INPUT_INVALID';
  end if;
  if (p_settings ? 'store_name' and (jsonb_typeof(p_settings->'store_name') <> 'string' or btrim(p_settings->>'store_name') = ''))
    or (p_settings ? 'address' and jsonb_typeof(p_settings->'address') not in ('string', 'null'))
    or (p_settings ? 'phone' and jsonb_typeof(p_settings->'phone') not in ('string', 'null'))
    or (p_settings ? 'logo_url' and jsonb_typeof(p_settings->'logo_url') not in ('string', 'null'))
    or (p_settings ? 'primary_color' and jsonb_typeof(p_settings->'primary_color') <> 'string')
    or (p_settings ? 'accent_color' and jsonb_typeof(p_settings->'accent_color') <> 'string')
    or (p_settings ? 'font_family' and (jsonb_typeof(p_settings->'font_family') <> 'string'
      or p_settings->>'font_family' not in ('Inter', 'Plus Jakarta Sans', 'Poppins', 'system-ui')))
    or (p_settings ? 'tax_percent' and jsonb_typeof(p_settings->'tax_percent') <> 'number')
    or (p_settings ? 'service_percent' and jsonb_typeof(p_settings->'service_percent') <> 'number')
    or (p_settings ? 'rounding_rule' and (jsonb_typeof(p_settings->'rounding_rule') <> 'string'
      or p_settings->>'rounding_rule' not in ('none', 'up_100', 'nearest_100')))
    or (p_settings ? 'receipt_header' and jsonb_typeof(p_settings->'receipt_header') not in ('string', 'null'))
    or (p_settings ? 'receipt_footer' and jsonb_typeof(p_settings->'receipt_footer') not in ('string', 'null'))
    or (p_settings ? 'paper_width_mm' and jsonb_typeof(p_settings->'paper_width_mm') <> 'number')
    or (p_settings ? 'require_verified_payment' and jsonb_typeof(p_settings->'require_verified_payment') <> 'boolean') then
    raise exception using errcode = 'P0001', message = 'INPUT_INVALID';
  end if;
  if (p_settings ? 'tax_percent' and (p_settings->>'tax_percent')::numeric not between 0 and 100)
    or (p_settings ? 'service_percent' and (p_settings->>'service_percent')::numeric not between 0 and 100)
    or (p_settings ? 'paper_width_mm' and (p_settings->>'paper_width_mm')::integer not in (58, 80)) then
    raise exception using errcode = 'P0001', message = 'INPUT_INVALID';
  end if;

  select * into v_settings from store_settings where id = 1 for update;
  v_primary_color := case when p_settings ? 'primary_color' then p_settings->>'primary_color' else v_settings.primary_color end;
  v_accent_color := case when p_settings ? 'accent_color' then p_settings->>'accent_color' else v_settings.accent_color end;
  if _contrast_ratio(v_primary_color, v_accent_color) < 4.5 then
    raise exception using errcode = 'P0001', message = 'CONTRAST_TOO_LOW';
  end if;

  update store_settings
  set store_name = case when p_settings ? 'store_name' then btrim(p_settings->>'store_name') else store_name end,
      address = case when p_settings ? 'address' then p_settings->>'address' else address end,
      phone = case when p_settings ? 'phone' then p_settings->>'phone' else phone end,
      logo_url = case when p_settings ? 'logo_url' then p_settings->>'logo_url' else logo_url end,
      primary_color = v_primary_color,
      accent_color = v_accent_color,
      font_family = case when p_settings ? 'font_family' then p_settings->>'font_family' else font_family end,
      tax_percent = case when p_settings ? 'tax_percent' then (p_settings->>'tax_percent')::numeric else tax_percent end,
      service_percent = case when p_settings ? 'service_percent' then (p_settings->>'service_percent')::numeric else service_percent end,
      rounding_rule = case when p_settings ? 'rounding_rule' then p_settings->>'rounding_rule' else rounding_rule end,
      receipt_header = case when p_settings ? 'receipt_header' then p_settings->>'receipt_header' else receipt_header end,
      receipt_footer = case when p_settings ? 'receipt_footer' then p_settings->>'receipt_footer' else receipt_footer end,
      paper_width_mm = case when p_settings ? 'paper_width_mm' then (p_settings->>'paper_width_mm')::integer else paper_width_mm end,
      require_verified_payment = case when p_settings ? 'require_verified_payment' then (p_settings->>'require_verified_payment')::boolean else require_verified_payment end,
      updated_by = auth.uid(),
      updated_at = now()
  where id = 1
  returning * into v_settings;

  insert into audit_logs (actor_id, action, entity, entity_id, payload)
  values (auth.uid(), 'settings.update', 'store_settings', '1', p_settings);
  return v_settings;
end;
$$;

revoke all on function _relative_luminance(text) from public, anon;
revoke all on function _contrast_ratio(text, text) from public, anon;
revoke all on function update_store_settings(jsonb) from public, anon;
grant execute on function update_store_settings(jsonb) to authenticated;