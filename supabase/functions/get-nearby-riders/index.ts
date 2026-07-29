import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3.25.76';

interface NearbyRiderRequest {
  customer_lat: number;
  customer_lng: number;
  radius_km?: number;
}

const NearbyRiderRequestSchema = z.object({
  customer_lat: z.number().min(-90).max(90),
  customer_lng: z.number().min(-180).max(180),
  radius_km: z.number().positive().max(100).optional(),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase environment is not configured');
    }
    const supabase = createClient(supabaseUrl, supabaseKey);

    const parsedRequest = NearbyRiderRequestSchema.safeParse(await req.json());
    if (!parsedRequest.success) {
      return new Response(
        JSON.stringify({ error: parsedRequest.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    const { customer_lat, customer_lng, radius_km = 10 }: NearbyRiderRequest = parsedRequest.data;

    console.log('Finding nearby riders for location:', { customer_lat, customer_lng, radius_km });

    // Fetch ALL active riders with branch location data (LEFT JOIN to avoid excluding riders without branches)
    const { data: riders, error: ridersError } = await supabase
      .from('profiles')
      .select(`
        id, full_name, phone, photo_url, last_known_lat, last_known_lng, location_updated_at, branch_id,
        branches(id, name, address, latitude, longitude)
      `)
      .in('role', ['rider', 'sb_rider', 'bh_rider', '2_Hub_Rider', '3_SB_Rider'])
      .eq('is_active', true);

    if (ridersError) {
      console.error('Error fetching riders:', ridersError);
      throw ridersError;
    }

    console.log('Total riders found:', riders?.length);

    // Calculate distances for all riders — checkpoint-based only.
    // Riders without a checkpoint today are excluded (per product decision).
    const ridersWithDistance = await Promise.all(
      (riders || []).map(async (rider) => {
        let riderLat: number | null = null;
        let riderLng: number | null = null;
        let hasGPS = false;
        let checkpointName: string | null = null;
        let checkpointTime: string | null = null;
        let locationSource: 'checkpoint' | 'gps' | 'branch' | 'none' = 'none';

        const branch = rider.branches as any;

        // Prefer the latest checkpoint today (Asia/Jakarta).
        const todayJkt = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().split('T')[0];
        const { data: latestCheckpoint } = await supabase
          .from('checkpoints')
          .select('latitude, longitude, checkpoint_name, address_info, created_at')
          .eq('rider_id', rider.id)
          .gte('created_at', `${todayJkt}T00:00:00+07:00`)
          .lte('created_at', `${todayJkt}T23:59:59+07:00`)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestCheckpoint) {
          riderLat = latestCheckpoint.latitude;
          riderLng = latestCheckpoint.longitude;
          hasGPS = true;
          locationSource = 'checkpoint';
          checkpointName = latestCheckpoint.checkpoint_name || latestCheckpoint.address_info || null;
          checkpointTime = latestCheckpoint.created_at;
        } else if (Number.isFinite(Number(branch?.latitude)) && Number.isFinite(Number(branch?.longitude))) {
          // A rider with accepted stock is ready for orders even before making a checkpoint.
          // Use the branch location temporarily until their first checkpoint today.
          riderLat = Number(branch.latitude);
          riderLng = Number(branch.longitude);
          locationSource = 'branch';
        }
        
        let distance_km = 9999;
        let eta_minutes = 0;

        if (riderLat !== null && riderLng !== null) {
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
        }

        // Check if rider has active shift TODAY
        const { data: activeShifts } = await supabase
          .from('shift_management')
          .select('id')
          .eq('rider_id', rider.id)
          .eq('shift_date', todayJkt)
          .eq('status', 'active')
          .is('shift_end_time', null)
          .limit(1);

        const is_shift_active = (activeShifts?.length || 0) > 0;

        // Check if rider is online (shift active AND location updated within last 10 minutes)
        let is_online = false;
        if (is_shift_active && rider.location_updated_at) {
          const lastUpdate = new Date(rider.location_updated_at).getTime();
          const now = new Date().getTime();
          const tenMinutes = 10 * 60 * 1000;
          is_online = (now - lastUpdate) < tenMinutes;
        }

        // Get rider inventory with product details
        const { data: inventory } = await supabase
          .from('inventory')
          .select('stock_quantity, products(id, name, description, price, image_url, category, custom_options)')
          .eq('rider_id', rider.id)
          .gt('stock_quantity', 0);

        const total_stock = inventory?.reduce((sum, item) => sum + (item.stock_quantity || 0), 0) || 0;
        const stock_items = (inventory || [])
          .filter((it: any) => it.products)
          .map((it: any) => ({
            product_id: it.products.id,
            name: it.products.name,
            description: it.products.description,
            price: it.products.price,
            image_url: it.products.image_url,
            category: it.products.category,
            custom_options: it.products.custom_options || null,
            stock_quantity: it.stock_quantity || 0,
          }));

        // Accepted rider inventory is the operational source of truth for availability.
        if (total_stock <= 0) return null;

        return {
          id: rider.id,
          full_name: rider.full_name,
          phone: rider.phone || '',
          photo_url: rider.photo_url || null,
          distance_km,
          eta_minutes,
          total_stock,
          stock_items,
          rating: 5.0,
          lat: riderLat,
          lng: riderLng,
          last_updated: rider.location_updated_at,
          is_online: true,
          is_shift_active,
          has_gps: hasGPS,
          location_source: locationSource,
          checkpoint_name: checkpointName,
          checkpoint_time: checkpointTime,
          branch_name: branch?.name || '',
          branch_address: branch?.address || ''
        };
      })
    );

    // Filter out riders without accepted/current stock.
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
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
