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
        { error: 'Invalid authentication token' },
        { status: 401 }
      )
    }

    // Check if the user is an admin
    const { data: adminProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('account_type')
      .eq('id', user.id)
      .single()

    if (profileError || adminProfile?.account_type !== 'admin') {
      console.error('Profile error:', profileError)
      console.error('User account type:', adminProfile?.account_type)
      return NextResponse.json(
        { error: 'Unauthorized: Admin access required' },
        { status: 403 }
      )
    }

    // Get query parameters
    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    // Simple query to get all user profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError)
      return NextResponse.json(
        { error: 'Failed to fetch profiles' },
        { status: 500 }
      )
    }

    // Get total count
    const { count } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })

    // Simple user list with placeholder emails for now
    const users = (profiles || []).map(profile => ({
      id: profile.id,
      email: `user-${profile.id.substring(0, 8)}@example.com`,
      full_name: profile.full_name,
      company: profile.company,
      account_type: profile.account_type,
      subscription_tier: profile.subscription_tier,
      max_active_queries: profile.max_active_queries,
      is_suspended: profile.is_suspended,
      last_login_at: profile.last_login_at,
      created_at: profile.created_at,
      updated_at: profile.updated_at,
      status: 'active'
    }))

    // Basic stats
    const stats = {
      totalUsers: count || 0,
      freeUsers: users.filter(u => u.subscription_tier === 'free').length,
      proUsers: users.filter(u => u.subscription_tier === 'pro').length,
      privilegedUsers: users.filter(u => ['admin', 'privileged'].includes(u.account_type)).length,
      activeQueries: 0
    }

    return NextResponse.json({
      users,
      stats,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    })

  } catch (error) {
    console.error('Admin users API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}