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
    console.log('Token received:', token ? 'Token present' : 'No token')
    
    // Verify the user is authenticated and get their profile
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      console.error('Auth error:', authError)
      return NextResponse.json(
        { error: 'Invalid authentication token', details: authError },
        { status: 401 }
      )
    }

    console.log('User authenticated:', user.id, user.email)

    // Check if the user is an admin
    const { data: adminProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('account_type, email')
      .eq('id', user.id)
      .single()

    console.log('Profile lookup result:', { adminProfile, profileError })

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