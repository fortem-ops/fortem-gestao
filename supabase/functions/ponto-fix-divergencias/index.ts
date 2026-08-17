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
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401)
    const token = authHeader.replace('Bearer ', '')

    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
    )
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token)
    const userId = claimsData?.claims?.sub as string | undefined
    if (claimsError || !userId) return json({ error: 'Unauthorized' }, 401)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: isAdmin } = await admin.rpc('is_admin', { _user_id: userId })
    if (!isAdmin) return json({ error: 'Forbidden: admin only' }, 403)

    // Buscar todas as jornadas encerradas (paginado)
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
