import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const grab = async (url: string) => {
    try {
      const r = await fetch(url)
      return (await r.text()).trim().slice(0, 100)
    } catch (e) {
      return `err: ${String(e).slice(0, 80)}`
    }
  }

  const [ipv4, ipv6, any] = await Promise.all([
    grab('https://api.ipify.org'),
    grab('https://api64.ipify.org'),
    grab('https://ifconfig.me/ip'),
  ])

  return new Response(JSON.stringify({ ipv4, ipv6, any }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
