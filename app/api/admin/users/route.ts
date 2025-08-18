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

    // We'll count after filtering since we need to include email search

    // First, get all auth users (this is the source of truth)
    const { data: allAuthUsers, error: authUsersError } = await supabase
      .from('auth.users')
      .select('id, email, created_at')
      .order('created_at', { ascending: false })

    if (authUsersError) {
      console.error('Error fetching auth users:', authUsersError)
      return NextResponse.json(
        { error: 'Failed to fetch auth users' },
        { status: 500 }
      )
    }

    // Get all user profiles
    const allProfilesQuery = baseQuery.order('created_at', { ascending: false })
    const { data: allUserProfiles, error: profilesError } = await allProfilesQuery

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError)
      return NextResponse.json(
        { error: 'Failed to fetch profiles' },
        { status: 500 }
      )
    }

    // Combine auth users with their profiles (some may not have profiles yet)
    let allUsers = (allAuthUsers || []).map(authUser => {
      const profile = allUserProfiles?.find(p => p.id === authUser.id)
      
      return {
        id: authUser.id,
        email: authUser.email || `user-${authUser.id.substring(0, 8)}@example.com`,
        full_name: profile?.full_name || null,
        company: profile?.company || null,
        account_type: profile?.account_type || 'user',
        subscription_tier: profile?.subscription_tier || 'free',
        max_active_queries: profile?.max_active_queries || 3,
        is_suspended: profile?.is_suspended || false,
        last_login_at: profile?.last_login_at || null,
        created_at: profile?.created_at || authUser.created_at,
        updated_at: profile?.updated_at || authUser.created_at,
        status: 'active' // We'll keep this as active for now
      }
    })

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

    // Calculate stats based on the combined user data
    const stats = {
      totalUsers: allUsers.length,
      freeUsers: allUsers.filter(u => u.subscription_tier === 'free').length,
      proUsers: allUsers.filter(u => u.subscription_tier === 'pro').length,
      privilegedUsers: allUsers.filter(u => u.account_type === 'admin' || u.account_type === 'privileged').length,
      activeQueries: 0 // We'll get this separately
    }

    // Get active queries count
    const { count: activeQueriesCount } = await supabase
      .from('queries')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
    
    stats.activeQueries = activeQueriesCount || 0

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