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
      return NextResponse.json(
        { error: 'Unauthorized: Admin access required' },
        { status: 403 }
      )
    }

    // Get all user profiles without filters
    const { data: allProfiles, error: profilesError } = await supabase
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (profilesError) {
      return NextResponse.json(
        { error: 'Failed to fetch profiles', details: profilesError },
        { status: 500 }
      )
    }

    // Count by subscription_tier
    const tierCounts = {
      free: 0,
      pro: 0,
      other: 0
    }

    // Count by account_type  
    const accountTypeCounts = {
      user: 0,
      admin: 0,
      privileged: 0,
      other: 0
    }

    (allProfiles || []).forEach(profile => {
      // Count subscription tiers
      if (profile.subscription_tier === 'free') {
        tierCounts.free++
      } else if (profile.subscription_tier === 'pro') {
        tierCounts.pro++
      } else {
        tierCounts.other++
      }

      // Count account types
      if (profile.account_type === 'user') {
        accountTypeCounts.user++
      } else if (profile.account_type === 'admin') {
        accountTypeCounts.admin++
      } else if (profile.account_type === 'privileged') {
        accountTypeCounts.privileged++
      } else {
        accountTypeCounts.other++
      }
    })

    return NextResponse.json({
      totalProfiles: (allProfiles || []).length,
      tierCounts,
      accountTypeCounts,
      profiles: allProfiles,
      currentUserId: user.id,
      currentUserProfile: adminProfile
    })

  } catch (error) {
    console.error('Debug API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    )
  }
}