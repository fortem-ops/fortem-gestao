grant execute on function public.fn_ponto_calcular_divergencias(uuid) to authenticated;
grant execute on function public.fn_ponto_consolidar_banco(uuid) to authenticated;

-- Remove lançamentos automáticos gerados por jornadas (preserva manuais)
delete from public.ponto_banco_horas
where tipo in ('tolerancia_excedida', 'hora_extra')
  and referencia_jornada_id is not null;

-- Reprocessa todas as jornadas com saída registrada
do $$
declare _id uuid;
begin
  for _id in
    select id from public.ponto_jornadas
    where saida is not null
    order by data
  loop
    perform public.fn_ponto_calcular_divergencias(_id);
    perform public.fn_ponto_consolidar_banco(_id);
  end loop;
end $$;