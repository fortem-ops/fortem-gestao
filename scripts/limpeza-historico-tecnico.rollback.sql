-- Desliga só a rotina de limpeza do histórico técnico de crons.
SELECT cron.unschedule('limpeza-historico-tecnico-diario');
