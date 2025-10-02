import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OrderRequest {
  customer_user_id: string;
  rider_profile_id: string;
  customer_lat: number;
  customer_lng: number;
  delivery_address: string;
  notes?: string;
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
      customer_user_id, 
      rider_profile_id, 
      customer_lat, 
      customer_lng,
      delivery_address,
      notes 
    }: OrderRequest = await req.json();

    console.log('Creating order request:', { customer_user_id, rider_profile_id });

    // Get customer_users id from user_id
    const { data: customerUser, error: customerError } = await supabase
      .from('customer_users')
      .select('id')
      .eq('user_id', customer_user_id)
      .single();

    if (customerError || !customerUser) {
      throw new Error('Customer not found');
    }

    // Calculate ETA based on rider distance (assuming 20 km/h)
    const { data: riderProfile } = await supabase
      .from('profiles')
      .select('last_known_lat, last_known_lng')
      .eq('id', rider_profile_id)
      .single();

    let eta_minutes = 15; // Default 15 minutes
    if (riderProfile?.last_known_lat && riderProfile?.last_known_lng) {
      const R = 6371;
      const dLat = (customer_lat - riderProfile.last_known_lat) * Math.PI / 180;
      const dLng = (customer_lng - riderProfile.last_known_lng) * Math.PI / 180;
      const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(riderProfile.last_known_lat * Math.PI / 180) * 
        Math.cos(customer_lat * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance_km = R * c;
      eta_minutes = Math.round((distance_km / 20) * 60);
    }

    const estimated_arrival = new Date(Date.now() + eta_minutes * 60 * 1000).toISOString();

    // Create order
    const { data: order, error: orderError } = await supabase
      .from('customer_orders')
      .insert({
        user_id: customerUser.id,
        rider_id: rider_profile_id,
        order_type: 'on_the_wheels',
        status: 'pending',
        delivery_address,
        latitude: customer_lat,
        longitude: customer_lng,
        estimated_arrival,
        total_price: 0, // Will be updated when order is completed
        payment_method: 'cash'
      })
      .select()
      .single();

    if (orderError) {
      console.error('Error creating order:', orderError);
      throw orderError;
    }

    console.log('Order created:', order.id);

    // Create order status history
    const { error: historyError } = await supabase
      .from('order_status_history')
      .insert({
        order_id: order.id,
        status: 'pending',
        notes: notes || 'Menunggu konfirmasi rider',
        latitude: customer_lat,
        longitude: customer_lng
      });

    if (historyError) {
      console.error('Error creating status history:', historyError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        order_id: order.id,
        estimated_arrival,
        eta_minutes 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-order-request:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
