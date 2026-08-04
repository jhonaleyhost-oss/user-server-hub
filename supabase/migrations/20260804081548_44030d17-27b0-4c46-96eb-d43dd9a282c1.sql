INSERT INTO public.app_settings (key, value)
VALUES ('austin_api_version', 'v2')
ON CONFLICT (key) DO NOTHING;