import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const userId = resolvedParams.id
    
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

    // Prevent admin from modifying their own permissions
    if (user.id === userId) {
      return NextResponse.json(
        { error: 'Cannot modify your own permissions' },
        { status: 400 }
      )
    }

    // Get the update data
    const body = await req.json()
    const { 
      account_type, 
      subscription_tier, 
      max_active_queries,
      full_name 
    } = body

    // Prevent manual editing of max_active_queries (managed by trigger)
    if (max_active_queries !== undefined) {
      return NextResponse.json(
        { error: 'max_active_queries is automatically set by account type and cannot be edited manually' },
        { status: 400 }
      )
    }

    // Prevent manual editing of subscription_tier (managed by Stripe)
    if (subscription_tier !== undefined) {
      return NextResponse.json(
        { error: 'subscription_tier is managed by Stripe and cannot be edited manually' },
        { status: 400 }
      )
    }

    // Validate account_type if provided
    if (account_type && !['user', 'privileged', 'admin'].includes(account_type)) {
      return NextResponse.json(
        { error: 'Invalid account type' },
        { status: 400 }
      )
    }

    // Build update object with only allowed fields
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    }

    if (account_type !== undefined) updateData.account_type = account_type
    if (full_name !== undefined) updateData.full_name = full_name

    console.log('Update attempt:', { userId, updateData })

    // First check if the user exists
    const { data: existingUser, error: existsError } = await supabase
      .from('user_profiles')
      .select('id, account_type')
      .eq('id', userId)
      .single()

    console.log('User exists check:', { existingUser, existsError })

    if (existsError || !existingUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Update the user
    const { data: updatedUser, error: updateError } = await supabase
      .from('user_profiles')
      .update(updateData)
      .eq('id', userId)
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
      .single()

    console.log('Update result:', { updatedUser, updateError })

    if (updateError) {
      console.error('Error updating user:', updateError)
      return NextResponse.json(
        { error: 'Failed to update user' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      user: updatedUser,
      message: 'User updated successfully'
    })

  } catch (error) {
    console.error('Admin user update error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const userId = resolvedParams.id
    
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

    // Prevent admin from deleting their own account
    if (user.id === userId) {
      return NextResponse.json(
        { error: 'Cannot delete your own account' },
        { status: 400 }
      )
    }

    // Check if the target user exists and get their info
    const { data: targetUser, error: targetError } = await supabase
      .from('user_profiles')
      .select('account_type, email')
      .eq('id', userId)
      .single()

    if (targetError || !targetUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Prevent deletion of other admin accounts
    if (targetUser.account_type === 'admin') {
      return NextResponse.json(
        { error: 'Cannot delete admin accounts' },
        { status: 400 }
      )
    }

    // Delete user's queries first (cascade)
    await supabase
      .from('queries')
      .delete()
      .eq('user_id', userId)

    // Delete user's jobs
    await supabase
      .from('jobs')
      .delete()
      .eq('user_id', userId)

    // Delete the user profile
    const { error: deleteError } = await supabase
      .from('user_profiles')
      .delete()
      .eq('id', userId)

    if (deleteError) {
      console.error('Error deleting user:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete user' },
        { status: 500 }
      )
    }

    // Also delete from auth.users (this requires service role)
    // Note: In production, you might want to handle this differently
    // or use Supabase's admin API

    return NextResponse.json({
      message: `User ${targetUser.email} deleted successfully`
    })

  } catch (error) {
    console.error('Admin user delete error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}