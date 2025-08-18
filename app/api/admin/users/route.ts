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

    // Get query parameters for pagination and filtering
    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''
    const accountType = searchParams.get('account_type') || ''
    const offset = (page - 1) * limit

    // Build the query with a join to get user emails
    let baseQuery = supabase
      .from('user_profiles')
      .select(`
        id,
        full_name,
        company,
        account_type,
        subscription_tier,
        max_active_queries,
        is_suspended,
        last_login_at,
        created_at,
        updated_at
      `)

    // Apply account type filter
    if (accountType) {
      baseQuery = baseQuery.eq('account_type', accountType)
    }

    // We'll handle search after getting the user data since we need to search both name and email

    // Get total count for pagination
    let countQuery = supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })

    if (accountType) {
      countQuery = countQuery.eq('account_type', accountType)
    }
    // We'll apply search filtering after getting the combined data

    const { count } = await countQuery

    // First, get all user profiles that match account type filter
    const allProfilesQuery = baseQuery.order('created_at', { ascending: false })
    const { data: allUserProfiles, error: usersError } = await allProfilesQuery

    if (usersError) {
      console.error('Error fetching users:', usersError)
      return NextResponse.json(
        { error: 'Failed to fetch users' },
        { status: 500 }
      )
    }

    // Fetch user emails from auth.users table
    const allUserIds = allUserProfiles?.map(profile => profile.id) || []
    let authUsers: any[] = []
    
    if (allUserIds.length > 0) {
      const { data: authData, error: authError } = await supabase
        .from('auth.users')
        .select('id, email')
        .in('id', allUserIds)

      if (authError) {
        console.error('Error fetching auth users:', authError)
        // Fall back to placeholder emails if auth query fails
        authUsers = allUserIds.map(id => ({
          id,
          email: `user-${id.substring(0, 8)}@example.com`
        }))
      } else {
        authUsers = authData || []
      }
    }

    // Combine profile data with email data
    let allUsers = allUserProfiles?.map(profile => {
      const authUser = authUsers.find(au => au.id === profile.id)
      return {
        ...profile,
        email: authUser?.email || `user-${profile.id.substring(0, 8)}@example.com`,
        status: 'active' // We'll keep this as active for now
      }
    }) || []

    // Apply search filter on the combined data (search by name or email)
    if (search) {
      const searchLower = search.toLowerCase()
      allUsers = allUsers.filter(user => 
        (user.full_name && user.full_name.toLowerCase().includes(searchLower)) ||
        (user.email && user.email.toLowerCase().includes(searchLower))
      )
    }

    // Update count to reflect search filtering
    const totalFilteredCount = allUsers.length

    // Apply pagination to the filtered results
    const users = allUsers.slice(offset, offset + limit)

    // Get additional stats
    const statsPromises = [
      // Total users
      supabase
        .from('user_profiles')
        .select('*', { count: 'exact', head: true }),
      
      // Free users
      supabase
        .from('user_profiles')
        .select('*', { count: 'exact', head: true })
        .eq('subscription_tier', 'free'),
      
      // Pro subscribers (pro tier)
      supabase
        .from('user_profiles')
        .select('*', { count: 'exact', head: true })
        .eq('subscription_tier', 'pro'),
      
      // Privileged users
      supabase
        .from('user_profiles')
        .select('*', { count: 'exact', head: true })
        .in('account_type', ['admin', 'privileged']),
      
      // Active queries system-wide
      supabase
        .from('queries')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)
    ]

    const [totalUsers, freeUsers, proUsers, privilegedUsers, activeQueries] = await Promise.all(statsPromises)

    const stats = {
      totalUsers: totalUsers.count || 0,
      freeUsers: freeUsers.count || 0,
      proUsers: proUsers.count || 0,
      privilegedUsers: privilegedUsers.count || 0,
      activeQueries: activeQueries.count || 0
    }

    return NextResponse.json({
      users,
      stats,
      pagination: {
        page,
        limit,
        total: totalFilteredCount,
        totalPages: Math.ceil(totalFilteredCount / limit)
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