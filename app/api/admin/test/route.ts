import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = req.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7)
    console.log('Token received:', token ? 'Token present' : 'No token')
    
    // Create an authenticated Supabase client with the user's token
    const supabaseUrl = process.env.SUPABASE_URL!
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    })
    
    // Verify the user is authenticated and get their profile
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      console.error('Auth error:', authError)
      return NextResponse.json(
        { error: 'Invalid authentication token', details: authError },
        { status: 401 }
      )
    }

    console.log('User authenticated:', user.id, user.email)

    // Now try to get the profile with the authenticated client
    const { data: adminProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('account_type, full_name, subscription_tier, max_active_queries')
      .eq('id', user.id)
      .single()

    console.log('Profile lookup result:', { adminProfile, profileError })
    console.log('User ID being queried:', user.id)

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email
      },
      profile: adminProfile,
      profileError: profileError,
      isAdmin: adminProfile?.account_type === 'admin'
    })

  } catch (error) {
    console.error('Admin test API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error },
      { status: 500 }
    )
  }
}