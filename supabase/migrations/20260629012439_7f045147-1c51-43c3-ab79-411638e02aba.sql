
INSERT INTO public.profiles (user_id, full_name)
SELECT u.id, COALESCE(NULLIF(u.raw_user_meta_data->>'full_name',''), NULLIF(u.email,''), 'Sem nome')
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = u.id);
