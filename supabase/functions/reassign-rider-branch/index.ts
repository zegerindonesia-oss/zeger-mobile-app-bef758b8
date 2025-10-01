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
    // Create admin client with service role
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

    // Verify user has permission (ho_admin only)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Create regular client to check permissions
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

    // Check if user is ho_admin
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!profile || profile.role !== 'ho_admin') {
      return new Response(JSON.stringify({ error: 'Only HO Admin can reassign riders' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Parse request body
    const { rider_email, target_branch_name, set_role_to_sb_rider } = await req.json();

    console.log('Reassigning rider:', { rider_email, target_branch_name, set_role_to_sb_rider });

    // Get rider profile by email
    const { data: riderProfile, error: riderError } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, branch_id, role')
      .eq('user_id', (
        await supabaseAdmin.auth.admin.listUsers()
      ).data.users?.find(u => u.email === rider_email)?.id)
      .single();

    if (riderError || !riderProfile) {
      return new Response(JSON.stringify({ error: `Rider not found with email: ${rider_email}` }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get target branch by name
    const { data: targetBranch, error: branchError } = await supabaseAdmin
      .from('branches')
      .select('id, name')
      .ilike('name', target_branch_name)
      .single();

    if (branchError || !targetBranch) {
      return new Response(JSON.stringify({ error: `Branch not found: ${target_branch_name}` }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const changes: any = {
      profiles_updated: 0,
      inventory_updated: 0,
      shift_management_updated: 0,
      old_branch_id: riderProfile.branch_id,
      new_branch_id: targetBranch.id
    };

    // 1. Update rider profile
    const updateData: any = {
      branch_id: targetBranch.id,
      updated_at: new Date().toISOString()
    };

    if (set_role_to_sb_rider && riderProfile.role !== 'sb_rider') {
      updateData.role = 'sb_rider';
      changes.role_changed = `${riderProfile.role} -> sb_rider`;
    }

    const { error: profileUpdateError } = await supabaseAdmin
      .from('profiles')
      .update(updateData)
      .eq('id', riderProfile.id);

    if (profileUpdateError) throw profileUpdateError;
    changes.profiles_updated = 1;

    // 2. Update inventory records for this rider
    const { error: inventoryError, count: inventoryCount } = await supabaseAdmin
      .from('inventory')
      .update({ branch_id: targetBranch.id })
      .eq('rider_id', riderProfile.id)
      .select('*', { count: 'exact', head: true });

    if (inventoryError) {
      console.warn('Inventory update error:', inventoryError);
    } else {
      changes.inventory_updated = inventoryCount || 0;
    }

    // 3. Update active shift management
    const { error: shiftError, count: shiftCount } = await supabaseAdmin
      .from('shift_management')
      .update({ branch_id: targetBranch.id })
      .eq('rider_id', riderProfile.id)
      .eq('status', 'active')
      .select('*', { count: 'exact', head: true });

    if (shiftError) {
      console.warn('Shift management update error:', shiftError);
    } else {
      changes.shift_management_updated = shiftCount || 0;
    }

    console.log('Reassignment completed:', changes);

    return new Response(JSON.stringify({
      success: true,
      message: `Rider ${riderProfile.full_name} (${rider_email}) successfully reassigned to ${targetBranch.name}`,
      changes
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error in reassign-rider-branch:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
