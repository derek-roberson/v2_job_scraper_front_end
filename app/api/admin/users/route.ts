import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/utils/supabase'

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
    
    // Verify the user is authenticated and get their profile
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
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

    // Build the query
    let query = supabase
      .from('user_profiles')
      .select(`
        id,
        email,
        full_name,
        account_type,
        subscription_tier,
        max_active_queries,
        created_at,
        updated_at,
        stripe_customer_id,
        stripe_subscription_id,
        status
      `)
      .order('created_at', { ascending: false })

    // Apply search filter
    if (search) {
      query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`)
    }

    // Apply account type filter
    if (accountType) {
      query = query.eq('account_type', accountType)
    }

    // Get total count for pagination
    const { count } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data: users, error: usersError } = await query

    if (usersError) {
      console.error('Error fetching users:', usersError)
      return NextResponse.json(
        { error: 'Failed to fetch users' },
        { status: 500 }
      )
    }

    // Get additional stats
    const statsPromises = [
      // Total users
      supabase
        .from('user_profiles')
        .select('*', { count: 'exact', head: true }),
      
      // Pro subscribers (with active subscription)
      supabase
        .from('user_profiles')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active'),
      
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

    const [totalUsers, proUsers, privilegedUsers, activeQueries] = await Promise.all(statsPromises)

    const stats = {
      totalUsers: totalUsers.count || 0,
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