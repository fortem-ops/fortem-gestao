INSERT INTO public.profiles (user_id, full_name, avatar_url)
VALUES ('a95eaac6-da86-45a2-a877-0e10316d6e64', 'Nicolas Squeff Janovik', null)
ON CONFLICT (user_id) DO UPDATE SET full_name = EXCLUDED.full_name;

ALTER TABLE public.whatsapp_mensagens
DROP CONSTRAINT IF EXISTS whatsapp_mensagens_enviado_por_fkey;