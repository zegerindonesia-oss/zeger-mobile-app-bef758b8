import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

Deno.serve((req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const key =
    Deno.env.get('VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY') ||
    Deno.env.get('LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY') ||
    Deno.env.get('GOOGLE_MAPS_BROWSER_KEY') ||
    ''

  const trackingId =
    Deno.env.get('VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID') ||
    Deno.env.get('LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID') ||
    Deno.env.get('GOOGLE_MAPS_TRACKING_ID') ||
    ''

  return new Response(JSON.stringify({ key, trackingId }), {
    status: key ? 200 : 404,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
