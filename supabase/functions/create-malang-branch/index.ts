import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Creating Zeger Branch Hub Malang and accounts...');

    // 1. Create Zeger Branch Hub Malang branch
    const { data: existingBranch } = await supabase
      .from('branches')
      .select('id')
      .eq('code', 'HUB-MLG')
      .single();

    let branchId = existingBranch?.id;

    if (!existingBranch) {
      const { data: newBranch, error: branchError } = await supabase
        .from('branches')
        .insert({
          code: 'HUB-MLG',
          name: 'Zeger Branch Hub Malang',
          branch_type: 'hub',
          address: 'Malang, Jawa Timur',
          is_active: true
        })
        .select()
        .single();

      if (branchError) {
        console.error('Error creating branch:', branchError);
        throw branchError;
      }

      branchId = newBranch.id;
      console.log('✅ Created Zeger Branch Hub Malang:', branchId);
    } else {
      console.log('✅ Branch already exists:', branchId);
    }

    // 2. Create accounts
    const accounts = [
      {
        email: 'setyaningrumfitria@gmail.com',
        password: 'zeger1234',
        full_name: 'Bu Fitria Setyaningrum',
        role: 'branch_manager',
        phone: null
      },
      {
        email: 'ZegerOTW09@gmail.com', 
        password: 'zeger1234',
        full_name: 'Pak Alut Z-009',
        role: 'rider',
        phone: null
      },
      {
        email: 'purnomoagungwibowo24@gmail.com',
        password: 'zeger1234', 
        full_name: 'Pak Agung Z-015',
        role: 'rider',
        phone: null
      }
    ];

    const results = [];

    for (const account of accounts) {
      console.log(`Creating account for ${account.full_name}...`);

      // Check if user already exists
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id, user_id')
        .eq('full_name', account.full_name)
        .single();

      if (existingProfile) {
        console.log(`✅ Account already exists for ${account.full_name}`);
        results.push({
          email: account.email,
          name: account.full_name,
          status: 'already_exists',
          profile_id: existingProfile.id
        });
        continue;
      }

      // Create auth user
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: account.email,
        password: account.password,
        email_confirm: true
      });

      if (authError) {
        console.error(`Error creating auth user for ${account.full_name}:`, authError);
        results.push({
          email: account.email,
          name: account.full_name,
          status: 'error',
          error: authError.message
        });
        continue;
      }

      // Create profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .insert({
          user_id: authUser.user.id,
          full_name: account.full_name,
          role: account.role,
          branch_id: branchId,
          phone: account.phone,
          is_active: true,
          app_access_type: account.role === 'rider' ? 'mobile_app' : 'web_backoffice'
        })
        .select()
        .single();

      if (profileError) {
        console.error(`Error creating profile for ${account.full_name}:`, profileError);
        results.push({
          email: account.email,
          name: account.full_name,
          status: 'error',
          error: profileError.message
        });
        continue;
      }

      console.log(`✅ Successfully created account for ${account.full_name}`);
      results.push({
        email: account.email,
        name: account.full_name,
        role: account.role,
        status: 'created',
        profile_id: profile.id
      });
    }

    return new Response(JSON.stringify({
      success: true,
      branch_id: branchId,
      accounts: results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in create-malang-branch function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});