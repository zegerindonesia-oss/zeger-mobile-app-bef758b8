import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create admin client with service role for atomic operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Create regular client to verify user
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader }
        }
      }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get user profile
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, role, branch_id')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return new Response(JSON.stringify({ error: 'User profile not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify user has permission (sb_branch_manager or ho_admin)
    if (!['sb_branch_manager', 'ho_admin'].includes(profile.role)) {
      return new Response(JSON.stringify({ error: 'Only Small Branch Managers can create purchases' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Parse request body
    const { supplier_name, purchase_date, notes, items, branch_id } = await req.json();

    // Validate input
    if (!supplier_name || !items || items.length === 0) {
      return new Response(JSON.stringify({ error: 'Missing required fields: supplier_name and items' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate branch_id matches user's branch (unless ho_admin)
    const useBranchId = branch_id || profile.branch_id;
    if (profile.role === 'sb_branch_manager' && useBranchId !== profile.branch_id) {
      return new Response(JSON.stringify({ error: 'Cannot create purchase for different branch' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Creating purchase for branch:', useBranchId);

    // Calculate total
    const totalAmount = items.reduce((sum: number, item: any) => 
      sum + (item.quantity * item.cost_per_unit), 0
    );

    // 1. Create purchase record
    const { data: purchase, error: purchaseError } = await supabaseAdmin
      .from('purchases')
      .insert({
        purchase_number: `PO-${Date.now()}`,
        supplier_name,
        purchase_date: purchase_date || new Date().toISOString().split('T')[0],
        notes: notes || '',
        total_amount: totalAmount,
        branch_id: useBranchId,
        created_by: profile.id,
        status: 'completed'
      })
      .select()
      .single();

    if (purchaseError) {
      console.error('Purchase creation error:', purchaseError);
      throw purchaseError;
    }

    console.log('Purchase created:', purchase.id);

    // 2. Create purchase items
    const purchaseItems = items.map((item: any) => ({
      purchase_id: purchase.id,
      product_id: item.product_id,
      quantity: item.quantity,
      cost_per_unit: item.cost_per_unit,
      total_cost: item.quantity * item.cost_per_unit
    }));

    const { error: itemsError } = await supabaseAdmin
      .from('purchase_items')
      .insert(purchaseItems);

    if (itemsError) {
      console.error('Purchase items error:', itemsError);
      // Rollback purchase
      await supabaseAdmin.from('purchases').delete().eq('id', purchase.id);
      throw itemsError;
    }

    console.log('Purchase items created');

    // 3. Update inventory (upsert for each product)
    const inventoryUpdates = [];
    for (const item of items) {
      // Check if inventory exists
      const { data: existingInv } = await supabaseAdmin
        .from('inventory')
        .select('*')
        .eq('product_id', item.product_id)
        .eq('branch_id', useBranchId)
        .is('rider_id', null)
        .maybeSingle();

      if (existingInv) {
        // Update existing
        const { error: updateError } = await supabaseAdmin
          .from('inventory')
          .update({
            stock_quantity: existingInv.stock_quantity + item.quantity,
            last_updated: new Date().toISOString()
          })
          .eq('id', existingInv.id);

        if (updateError) {
          console.error('Inventory update error:', updateError);
          throw updateError;
        }
        inventoryUpdates.push({ product_id: item.product_id, action: 'updated', new_stock: existingInv.stock_quantity + item.quantity });
      } else {
        // Insert new
        const { error: insertError } = await supabaseAdmin
          .from('inventory')
          .insert({
            product_id: item.product_id,
            branch_id: useBranchId,
            stock_quantity: item.quantity,
            min_stock_level: 5,
            max_stock_level: 100,
            rider_id: null
          });

        if (insertError) {
          console.error('Inventory insert error:', insertError);
          throw insertError;
        }
        inventoryUpdates.push({ product_id: item.product_id, action: 'created', new_stock: item.quantity });
      }

      // 4. Create stock movement
      const { error: movementError } = await supabaseAdmin
        .from('stock_movements')
        .insert({
          product_id: item.product_id,
          branch_id: useBranchId,
          movement_type: 'in',
          quantity: item.quantity,
          status: 'completed',
          reference_id: purchase.id,
          reference_type: 'purchase',
          notes: `Pembelian dari ${supplier_name}`,
          created_by: profile.id
        });

      if (movementError) {
        console.error('Stock movement error:', movementError);
        throw movementError;
      }
    }

    console.log('Inventory and stock movements updated:', inventoryUpdates);

    return new Response(JSON.stringify({
      success: true,
      purchase_id: purchase.id,
      purchase_number: purchase.purchase_number,
      total_amount: totalAmount,
      items_count: items.length,
      inventory_updates: inventoryUpdates
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error in create-purchase:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
