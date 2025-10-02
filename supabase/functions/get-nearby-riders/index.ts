import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NearbyRiderRequest {
  customer_lat: number;
  customer_lng: number;
  radius_km?: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { customer_lat, customer_lng, radius_km = 10 }: NearbyRiderRequest = await req.json();

    console.log('Finding nearby riders for location:', { customer_lat, customer_lng, radius_km });

    // Get all active riders with active shifts today
    const today = new Date().toISOString().split('T')[0];
    
    const { data: activeShifts, error: shiftsError } = await supabase
      .from('shift_management')
      .select('rider_id')
      .eq('shift_date', today)
      .eq('status', 'active')
      .is('shift_end_time', null);

    if (shiftsError) {
      console.error('Error fetching shifts:', shiftsError);
      throw shiftsError;
    }

    const activeRiderIds = activeShifts?.map(s => s.rider_id) || [];
    console.log('Active riders today:', activeRiderIds);

    if (activeRiderIds.length === 0) {
      return new Response(
        JSON.stringify({ riders: [], message: 'No active riders found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get rider profiles with location
    const { data: riders, error: ridersError } = await supabase
      .from('profiles')
      .select('id, full_name, phone, last_known_lat, last_known_lng, location_updated_at')
      .in('id', activeRiderIds)
      .eq('is_active', true)
      .not('last_known_lat', 'is', null)
      .not('last_known_lng', 'is', null);

    if (ridersError) {
      console.error('Error fetching riders:', ridersError);
      throw ridersError;
    }

    console.log('Riders with location:', riders?.length);

    // Calculate distances and filter by radius
    const ridersWithDistance = await Promise.all(
      (riders || []).map(async (rider) => {
        // Haversine formula for distance calculation
        const R = 6371; // Earth radius in km
        const dLat = (customer_lat - rider.last_known_lat!) * Math.PI / 180;
        const dLng = (customer_lng - rider.last_known_lng!) * Math.PI / 180;
        const a = 
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(rider.last_known_lat! * Math.PI / 180) * 
          Math.cos(customer_lat * Math.PI / 180) *
          Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance_km = R * c;

        // Get rider inventory count
        const { data: inventory } = await supabase
          .from('inventory')
          .select('stock_quantity')
          .eq('rider_id', rider.id);

        const total_stock = inventory?.reduce((sum, item) => sum + (item.stock_quantity || 0), 0) || 0;

        // Calculate ETA (assuming 20 km/h average speed)
        const eta_minutes = Math.round((distance_km / 20) * 60);

        return {
          id: rider.id,
          full_name: rider.full_name,
          phone: rider.phone || '',
          distance_km: Math.round(distance_km * 100) / 100,
          eta_minutes,
          total_stock,
          rating: 4.5, // TODO: Implement real rating system
          lat: rider.last_known_lat,
          lng: rider.last_known_lng,
          last_updated: rider.location_updated_at
        };
      })
    );

    // Filter by radius and sort by distance
    const nearbyRiders = ridersWithDistance
      .filter(r => r.distance_km <= radius_km)
      .sort((a, b) => a.distance_km - b.distance_km);

    console.log('Nearby riders found:', nearbyRiders.length);

    return new Response(
      JSON.stringify({ riders: nearbyRiders }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in get-nearby-riders:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
