import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/utils/supabase'

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
    
    // Verify the user is authenticated and get their profile
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      )
    }

    // Check if the user is an admin
    const { data: adminProfile, error: profileError } = await supabase
      .from('profiles')
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

    // Validate account_type if provided
    if (account_type && !['standard', 'privileged', 'admin'].includes(account_type)) {
      return NextResponse.json(
        { error: 'Invalid account type' },
        { status: 400 }
      )
    }

    // Validate subscription_tier if provided
    if (subscription_tier && !['free', 'basic', 'premium'].includes(subscription_tier)) {
      return NextResponse.json(
        { error: 'Invalid subscription tier' },
        { status: 400 }
      )
    }

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    }

    if (account_type !== undefined) updateData.account_type = account_type
    if (subscription_tier !== undefined) updateData.subscription_tier = subscription_tier
    if (max_active_queries !== undefined) updateData.max_active_queries = max_active_queries
    if (full_name !== undefined) updateData.full_name = full_name

    // Update the user
    const { data: updatedUser, error: updateError } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', userId)
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
      .single()

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
    
    // Verify the user is authenticated and get their profile
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      )
    }

    // Check if the user is an admin
    const { data: adminProfile, error: profileError } = await supabase
      .from('profiles')
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
      .from('profiles')
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
      .from('profiles')
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