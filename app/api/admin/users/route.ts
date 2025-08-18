import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

interface UserProfile {
  id: string
  full_name: string | null
  company: string | null
  account_type: string
  subscription_tier: string
  max_active_queries: number
  is_suspended: boolean
  last_login_at: string | null
  created_at: string
  updated_at: string
}

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
    console.log('Checking admin access for user:', user.id)
    const { data: adminProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('account_type')
      .eq('id', user.id)
      .single()

    console.log('Profile lookup result:', { adminProfile, profileError })
    
    if (profileError || adminProfile?.account_type !== 'admin') {
      console.error('Profile error:', profileError)
      console.error('User account type:', adminProfile?.account_type)
      console.error('Access denied for user:', user.id)
      return NextResponse.json(
        { error: 'Unauthorized: Admin access required' },
        { status: 403 }
      )
    }
    
    console.log('Admin access granted for user:', user.id)

    // Get query parameters
    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    // Use the admin function to get all user profiles (bypasses RLS securely)
    const { data: allProfiles, error: profilesError } = await supabase
      .rpc('get_all_user_profiles_for_admin') as { data: UserProfile[] | null, error: Error | null }

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError)
      return NextResponse.json(
        { error: 'Failed to fetch profiles' },
        { status: 500 }
      )
    }

    // Apply pagination to the results
    const profiles = allProfiles?.slice(offset, offset + limit)

    // Debug logging
    console.log('Found total profiles:', allProfiles?.length || 0)
    console.log('Paginated profiles count:', profiles?.length || 0)
    console.log('Profile subscription tiers:', profiles?.map((p: UserProfile) => p.subscription_tier))
    console.log('Profile account types:', profiles?.map((p: UserProfile) => p.account_type))
    console.log('Profile IDs:', profiles?.map((p: UserProfile) => p.id.substring(0, 8)))
    console.log('Sample profile:', profiles?.[0])
    
    const totalCount = allProfiles?.length || 0

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

    // Basic stats - calculate from all profiles, not just the paginated ones
    const stats = {
      totalUsers: totalCount,
      freeUsers: allProfiles?.filter((u: UserProfile) => u.subscription_tier === 'free').length || 0,
      proUsers: allProfiles?.filter((u: UserProfile) => u.subscription_tier === 'pro').length || 0,
      privilegedUsers: allProfiles?.filter((u: UserProfile) => ['admin', 'privileged'].includes(u.account_type)).length || 0,
      activeQueries: 0
    }

    return NextResponse.json({
      users,
      stats,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit)
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