import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RespondRequest {
  order_id: string;
  rider_profile_id: string;
  action: 'accept' | 'reject';
  rejection_reason?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { order_id, rider_profile_id, action, rejection_reason }: RespondRequest = await req.json();

    console.log('Rider response:', { order_id, rider_profile_id, action });

    // Validate order exists and is pending
    const { data: order, error: orderError } = await supabase
      .from('customer_orders')
      .select('id, status, rider_id, latitude, longitude')
      .eq('id', order_id)
      .single();

    if (orderError || !order) {
      throw new Error('Order not found');
    }

    if (order.status !== 'pending') {
      throw new Error('Order is not in pending status');
    }

    if (order.rider_id !== rider_profile_id) {
      throw new Error('Order not assigned to this rider');
    }

    if (action === 'accept') {
      // Update order status to accepted
      const { error: updateError } = await supabase
        .from('customer_orders')
        .update({ 
          status: 'accepted',
          updated_at: new Date().toISOString()
        })
        .eq('id', order_id);

      if (updateError) {
        console.error('Error updating order:', updateError);
        throw updateError;
      }

      // Create status history
      await supabase
        .from('order_status_history')
        .insert({
          order_id,
          status: 'accepted',
          notes: 'Rider menerima pesanan',
          latitude: order.latitude,
          longitude: order.longitude
        });

      console.log('Order accepted successfully');

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Order accepted',
          status: 'accepted'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'reject') {
      // Update order status to rejected
      const { error: updateError } = await supabase
        .from('customer_orders')
        .update({ 
          status: 'rejected',
          rejection_reason: rejection_reason || 'Tidak ada alasan',
          updated_at: new Date().toISOString()
        })
        .eq('id', order_id);

      if (updateError) {
        console.error('Error updating order:', updateError);
        throw updateError;
      }

      // Create status history
      await supabase
        .from('order_status_history')
        .insert({
          order_id,
          status: 'rejected',
          notes: rejection_reason || 'Rider menolak pesanan',
          latitude: order.latitude,
          longitude: order.longitude
        });

      console.log('Order rejected:', rejection_reason);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Order rejected',
          status: 'rejected',
          reason: rejection_reason
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error('Invalid action');

  } catch (error) {
    console.error('Error in rider-respond-order:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
