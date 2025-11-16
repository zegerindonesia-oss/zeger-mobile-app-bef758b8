import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify user authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Unauthorized: No authorization header');
    }

    // Create client with user's auth token for authentication
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
      console.error('Auth error:', authError);
      throw new Error('Unauthorized');
    }

    // Create admin client for database operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { void_request_id, action, reviewer_notes } = await req.json();
    console.log('Processing void request:', { void_request_id, action, user_id: user.id });
    
    // Get void request details with transaction data
    const { data: voidRequest, error: voidError } = await supabaseAdmin
      .from('transaction_void_requests')
      .select('*, transactions(*)')
      .eq('id', void_request_id)
      .single();

    if (voidError || !voidRequest) {
      console.error('Void request fetch error:', voidError);
      throw new Error('Void request not found');
    }

    console.log('Void request found:', voidRequest);

    // Verify user has permission to approve/reject
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, role, branch_id')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('Profile fetch error:', profileError);
      throw new Error('User profile not found');
    }

    console.log('User profile:', profile);

    // Check permissions: ho_admin can approve all, managers can only approve their branch
    if (!['branch_manager', 'sb_branch_manager', 'ho_admin'].includes(profile.role)) {
      throw new Error('Insufficient permissions: invalid role');
    }

    if (profile.role !== 'ho_admin' && profile.branch_id !== voidRequest.branch_id) {
      throw new Error('Insufficient permissions: branch mismatch');
    }

    if (action === 'approve') {
      console.log('Approving void request...');

      // Check if transaction is already voided
      if (voidRequest.transactions.is_voided) {
        throw new Error('Transaction is already voided');
      }

      // 1. Update transaction status
      const { error: txError } = await supabaseAdmin
        .from('transactions')
        .update({
          is_voided: true,
          voided_at: new Date().toISOString(),
          voided_by: profile.id,
          void_reason: voidRequest.reason,
        })
        .eq('id', voidRequest.transaction_id);

      if (txError) {
        console.error('Transaction update error:', txError);
        throw txError;
      }

      console.log('Transaction voided successfully');

      // 2. Create financial reversal entries
      const transactionAmount = voidRequest.transactions.final_amount;
      
      // Insert negative revenue entry to reverse the original revenue
      const { error: revenueReversalError } = await supabaseAdmin
        .from('financial_transactions')
        .insert({
          transaction_id: voidRequest.transaction_id,
          branch_id: voidRequest.branch_id,
          transaction_type: 'revenue',
          account_type: 'sales',
          amount: -transactionAmount,
          description: `Void Transaction - ${voidRequest.transactions.transaction_number}`,
          reference_number: voidRequest.transactions.transaction_number,
          created_by: profile.id
        });

      if (revenueReversalError) {
        console.error('Revenue reversal error:', revenueReversalError);
        throw revenueReversalError;
      }

      // Insert negative cash entry to reverse the original cash receipt
      const { error: cashReversalError } = await supabaseAdmin
        .from('financial_transactions')
        .insert({
          transaction_id: voidRequest.transaction_id,
          branch_id: voidRequest.branch_id,
          transaction_type: 'asset',
          account_type: 'cash',
          amount: -transactionAmount,
          description: `Void Transaction - ${voidRequest.transactions.transaction_number}`,
          reference_number: voidRequest.transactions.transaction_number,
          created_by: profile.id
        });

      if (cashReversalError) {
        console.error('Cash reversal error:', cashReversalError);
        throw cashReversalError;
      }

      console.log('Financial reversals created successfully');

      // 3. Restore inventory for transaction items
      const { data: txItems, error: itemsError } = await supabaseAdmin
        .from('transaction_items')
        .select('product_id, quantity')
        .eq('transaction_id', voidRequest.transaction_id);

      if (itemsError) {
        console.error('Transaction items fetch error:', itemsError);
        throw itemsError;
      }

      console.log('Transaction items to restore:', txItems);

      if (txItems && txItems.length > 0) {
        for (const item of txItems) {
          console.log('Restoring inventory:', { 
            rider_id: voidRequest.rider_id, 
            product_id: item.product_id, 
            quantity: item.quantity 
          });

          const { error: invError } = await supabaseAdmin.rpc('increment_inventory_stock', {
            p_rider_id: voidRequest.rider_id,
            p_product_id: item.product_id,
            p_quantity: item.quantity
          });

          if (invError) {
            console.error('Inventory restore error:', invError);
            throw invError;
          }
        }
        console.log('Inventory restored successfully');
      }

      // 4. Update void request status
      const { error: updateError } = await supabaseAdmin
        .from('transaction_void_requests')
        .update({
          status: 'approved',
          reviewed_by: profile.id,
          reviewed_at: new Date().toISOString(),
          reviewer_notes: reviewer_notes || null,
        })
        .eq('id', void_request_id);

      if (updateError) {
        console.error('Void request update error:', updateError);
        throw updateError;
      }

      console.log('Void request approved successfully');

      return new Response(
        JSON.stringify({ success: true, message: 'Transaction voided successfully' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'reject') {
      console.log('Rejecting void request...');

      // Update void request status to rejected
      const { error: updateError } = await supabaseAdmin
        .from('transaction_void_requests')
        .update({
          status: 'rejected',
          reviewed_by: profile.id,
          reviewed_at: new Date().toISOString(),
          reviewer_notes: reviewer_notes || null,
        })
        .eq('id', void_request_id);

      if (updateError) {
        console.error('Void request rejection error:', updateError);
        throw updateError;
      }

      console.log('Void request rejected successfully');

      return new Response(
        JSON.stringify({ success: true, message: 'Void request rejected' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      throw new Error('Invalid action. Must be "approve" or "reject"');
    }

  } catch (error: any) {
    console.error('Error processing void request:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
