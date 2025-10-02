import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LocationUpdate {
  rider_profile_id: string;
  lat: number;
  lng: number;
  accuracy?: number;
  heading?: number;
  speed?: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { 
      rider_profile_id, 
      lat, 
      lng, 
      accuracy, 
      heading, 
      speed 
    }: LocationUpdate = await req.json();

    console.log('Updating rider location:', { rider_profile_id, lat, lng });

    // Update profiles table
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        last_known_lat: lat,
        last_known_lng: lng,
        location_updated_at: new Date().toISOString()
      })
      .eq('id', rider_profile_id);

    if (profileError) {
      console.error('Error updating profile location:', profileError);
      throw profileError;
    }

    // Upsert rider_locations table
    const { error: locationError } = await supabase
      .from('rider_locations')
      .upsert({
        rider_id: rider_profile_id,
        latitude: lat,
        longitude: lng,
        accuracy,
        heading,
        speed,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'rider_id'
      });

    if (locationError) {
      console.error('Error upserting rider_locations:', locationError);
      throw locationError;
    }

    console.log('Location updated successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Location updated',
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in update-rider-location-live:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
