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

    // Fetch ALL active riders - including those without GPS
    const { data: riders, error: ridersError } = await supabase
      .from('profiles')
      .select(`
        id,
        full_name,
        phone,
        last_known_lat,
        last_known_lng,
        location_updated_at,
        branch_id,
        branches!inner (
          name,
          address,
          latitude,
          longitude
        )
      `)
      .eq('role', 'rider')
      .eq('is_active', true);

    if (ridersError) {
      console.error('Error fetching riders:', ridersError);
      throw ridersError;
    }

    console.log('Total riders found:', riders?.length);

    // Calculate distances for all riders with fallback to branch location
    const ridersWithDistance = await Promise.all(
      (riders || []).map(async (rider) => {
        // Check if rider has GPS location
        const hasGPS = rider.last_known_lat !== null && rider.last_known_lng !== null;
        
        // Use rider GPS if available, otherwise fallback to branch location
        const riderLat = hasGPS ? rider.last_known_lat : (rider.branches?.latitude || 0);
        const riderLng = hasGPS ? rider.last_known_lng : (rider.branches?.longitude || 0);
        
        let distance_km = 9999;
        let eta_minutes = 0;

        // Calculate distance using Haversine formula
        if (riderLat && riderLng) {
          const R = 6371; // Earth radius in km
          const dLat = (customer_lat - riderLat) * Math.PI / 180;
          const dLng = (customer_lng - riderLng) * Math.PI / 180;
          const a = 
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(riderLat * Math.PI / 180) * 
            Math.cos(customer_lat * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          distance_km = Math.round((R * c) * 100) / 100;

          // Calculate ETA (assuming 20 km/h average speed)
          eta_minutes = Math.round((distance_km / 20) * 60);
        }

        // Check if rider is online (location updated within last 10 minutes)
        let is_online = false;
        if (hasGPS && rider.location_updated_at) {
          const lastUpdate = new Date(rider.location_updated_at).getTime();
          const now = new Date().getTime();
          const tenMinutes = 10 * 60 * 1000;
          is_online = (now - lastUpdate) < tenMinutes;
        }

        // Get rider inventory count
        const { data: inventory } = await supabase
          .from('inventory')
          .select('stock_quantity')
          .eq('rider_id', rider.id);

        const total_stock = inventory?.reduce((sum, item) => sum + (item.stock_quantity || 0), 0) || 0;

        return {
          id: rider.id,
          full_name: rider.full_name,
          phone: rider.phone || '',
          distance_km,
          eta_minutes,
          total_stock,
          rating: 4.5,
          lat: riderLat,
          lng: riderLng,
          last_updated: rider.location_updated_at,
          is_online,
          has_gps: hasGPS,
          branch_name: rider.branches?.name || '',
          branch_address: rider.branches?.address || ''
        };
      })
    );

    // Filter by radius and sort: online riders first (by distance), then offline riders
    const nearbyRiders = ridersWithDistance
      .filter(rider => rider.distance_km <= radius_km)
      .sort((a, b) => {
        if (a.is_online && !b.is_online) return -1;
        if (!a.is_online && b.is_online) return 1;
        return a.distance_km - b.distance_km;
      });

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
