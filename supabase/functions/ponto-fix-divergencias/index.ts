import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    const admin = createClient(supabaseUrl, serviceKey)
    const isServiceRole = authHeader === `Bearer ${serviceKey}`

    if (!isServiceRole) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      })
      const { data: { user }, error: authError } = await userClient.auth.getUser()
      if (authError || !user) return json({ error: 'Unauthorized' }, 401)

      const { data: isAdmin } = await admin.rpc('is_admin', { _user_id: user.id })
      if (!isAdmin) return json({ error: 'Forbidden — requires admin role' }, 403)
    }

    const { error: delErr } = await admin
      .from('ponto_banco_horas')
      .delete()
      .in('tipo', ['tolerancia_excedida', 'hora_extra'])
      .not('referencia_jornada_id', 'is', null)
    if (delErr) return json({ error: delErr.message }, 500)

    const ids: string[] = []
    const pageSize = 1000
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await admin
        .from('ponto_jornadas')
        .select('id')
        .not('saida', 'is', null)
        .order('data', { ascending: true })
        .range(from, from + pageSize - 1)
      if (error) return json({ error: error.message }, 500)
      const rows = data ?? []
      ids.push(...rows.map((r: { id: string }) => r.id))
      if (rows.length < pageSize) break
    }

    let ok = 0
    const erros: string[] = []
    for (const id of ids) {
      const r1 = await admin.rpc('fn_ponto_calcular_divergencias', { _jornada_id: id })
      const r2 = await admin.rpc('fn_ponto_consolidar_banco', { _jornada_id: id })
      if (r1.error || r2.error) erros.push(`${id}: ${r1.error?.message ?? r2.error?.message}`)
      else ok++
    }

    return json({ total: ids.length, reprocessadas: ok, erros: erros.slice(0, 20), falhas: erros.length })
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})
