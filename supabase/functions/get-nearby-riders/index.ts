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

    // Fetch ALL active riders with branch location data (LEFT JOIN to avoid excluding riders without branches)
    const { data: riders, error: ridersError } = await supabase
      .from('profiles')
      .select(`
        id, full_name, phone, last_known_lat, last_known_lng, location_updated_at, branch_id,
        branches(id, name, address, latitude, longitude)
      `)
      .or('role.eq.rider,role.eq.sb_rider,role.eq.bh_rider')
      .eq('is_active', true);

    if (ridersError) {
      console.error('Error fetching riders:', ridersError);
      throw ridersError;
    }

    console.log('Total riders found:', riders?.length);

    // Calculate distances for all riders with fallback
    const ridersWithDistance = await Promise.all(
      (riders || []).map(async (rider) => {
        let riderLat = rider.last_known_lat;
        let riderLng = rider.last_known_lng;
        let hasGPS = riderLat !== null && riderLng !== null;
        
        // Fallback 1: try to get latest location from rider_locations table
        if (!hasGPS) {
          const { data: recentLocation } = await supabase
            .from('rider_locations')
            .select('latitude, longitude, updated_at')
            .eq('rider_id', rider.id)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (recentLocation) {
            riderLat = recentLocation.latitude;
            riderLng = recentLocation.longitude;
            hasGPS = true;
            console.log(`Rider ${rider.full_name} using rider_locations GPS`);
          }
        }

        // Fallback 2: use branch location if rider has no GPS
        if (!hasGPS && rider.branches) {
          const branch = rider.branches as any;
          if (branch.latitude && branch.longitude) {
            riderLat = branch.latitude;
            riderLng = branch.longitude;
            hasGPS = false; // Still mark as no direct GPS
            console.log(`Rider ${rider.full_name} using branch location fallback: ${branch.name}`);
          }
        }

        // Don't skip riders without location - show them with high distance
        if (riderLat == null || riderLng == null) {
          console.log(`Rider ${rider.full_name} has no location data - setting distance to 9999`);
          riderLat = 0;
          riderLng = 0;
        }
        
        let distance_km = 9999;
        let eta_minutes = 0;

        // Calculate distance using Haversine formula
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

        // Check if rider has active shift TODAY
        const { data: activeShift } = await supabase
          .from('shift_management')
          .select('id')
          .eq('rider_id', rider.id)
          .eq('shift_date', new Date().toISOString().split('T')[0])
          .eq('status', 'active')
          .is('shift_end_time', null)
          .maybeSingle();

        const is_shift_active = !!activeShift;

        // Check if rider is online (shift active AND location updated within last 10 minutes)
        let is_online = false;
        if (is_shift_active && rider.location_updated_at) {
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

        const branch = rider.branches as any;

        return {
          id: rider.id,
          full_name: rider.full_name,
          phone: rider.phone || '',
          photo_url: null, // Field removed from profiles table
          distance_km,
          eta_minutes,
          total_stock,
          rating: 5.0,
          lat: riderLat,
          lng: riderLng,
          last_updated: rider.location_updated_at,
          is_online,
          is_shift_active,
          has_gps: hasGPS,
          branch_name: branch?.name || '',
          branch_address: branch?.address || ''
        };
      })
    );

    // Filter out null entries (show ALL riders)
    const validRiders = ridersWithDistance.filter((r): r is NonNullable<typeof r> => r !== null)

    // Sort: shift active first, then online by distance, then offline
    const nearbyRiders = validRiders
      .sort((a, b) => {
        // Shift active riders first
        if (a.is_shift_active && !b.is_shift_active) return -1;
        if (!a.is_shift_active && b.is_shift_active) return 1;
        // Among shift active, online first
        if (a.is_online && !b.is_online) return -1;
        if (!a.is_online && b.is_online) return 1;
        // Sort by distance
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
