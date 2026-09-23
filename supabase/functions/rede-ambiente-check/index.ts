// Checagem temporária: informa apenas o ambiente configurado da Rede.
// Nunca retorna credenciais.
Deno.serve(() => {
  const amb = (Deno.env.get("REDE_AMBIENTE") ?? "").trim().toLowerCase();
  const ambiente = amb === "producao" || amb === "produção" ? "producao" : amb === "sandbox" ? "sandbox" : "nao_definido";
  return new Response(JSON.stringify({ ambiente }), {
    headers: { "Content-Type": "application/json" },
  });
});
