import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    // 1. Get the user making the request
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) throw new Error('Unauthorized');

    // 2. Get inviter's profile to check permissions and get company ID
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('empresa_id, role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) throw new Error('Profile not found');
    
    if (profile.role !== 'admin') {
      throw new Error('Only admins can invite users');
    }

    if (!profile.empresa_id) {
      throw new Error('You must belong to a company to invite users');
    }

    // 3. Get request body
    const { email, nome, role } = await req.json();

    if (!email) throw new Error('Email is required');

    // Get the origin from the request or referer to use as the redirect URL
    let origin = req.headers.get('origin') || req.headers.get('referer') || '';
    
    // Clean up origin (remove trailing slash)
    if (origin.endsWith('/')) {
      origin = origin.slice(0, -1);
    }
    
    // If origin is empty, we might have a problem, but Supabase usually requires an absolute URL for redirectTo.
    // We assume the client calling this is a browser.

    // 4. Invite user using Service Role Key (Admin)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SERVICE_ROLE_KEY') ?? ''
    );

    const { data: invitation, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      {
        redirectTo: `${origin}/profile-setup`,
        data: {
          empresa_id_convite: profile.empresa_id,
          cargo_convite: role || 'user',
          nome: nome,
          company_name: 'Pilar' // Just a placeholder, logic handled by trigger
        }
      }
    );

    if (inviteError) throw inviteError;

    return new Response(
      JSON.stringify(invitation),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});
