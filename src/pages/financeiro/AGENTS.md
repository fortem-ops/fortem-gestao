# Finance pages

- Contract proposals use the existing `PropostasSite2027` list on a dedicated coordinator/admin page, with admin-only sensitive controls and legacy Leads redirects; why: relocation must preserve payment behavior and authorization.
- Email resend calls the server-verified admin action with a stable request key retained on failure; why: retries cannot duplicate a deliberate resend.