'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/utils/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertCircle, Check, Eye, EyeOff, Lock } from 'lucide-react'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [isValidToken, setIsValidToken] = useState(false)
  const [checkingToken, setCheckingToken] = useState(true)

  useEffect(() => {
    // Check for recovery token in URL
    const checkRecoveryToken = async () => {
      // Get token from URL params (if coming from custom email template)
      const urlParams = new URLSearchParams(window.location.search)
      const token = urlParams.get('token')
      const type = urlParams.get('type')
      
      // Get token from URL hash (if coming from default Supabase redirect)
      const hashParams = new URLSearchParams(window.location.hash.substring(1))
      const hashToken = hashParams.get('access_token')
      const hashType = hashParams.get('type')
      
      // Check if this is a recovery type token from either source
      if ((type === 'recovery' && token) || (hashType === 'recovery' && hashToken)) {
        // Sign out any existing session to prevent auto-login
        await supabase.auth.signOut()
        
        // For hash-based tokens (from default Supabase redirect)
        if (hashType === 'recovery' && hashToken) {
          try {
            // Set the session with the recovery token
            const { error } = await supabase.auth.setSession({
              access_token: hashToken,
              refresh_token: hashParams.get('refresh_token') || ''
            })
            
            if (!error) {
              setIsValidToken(true)
            } else {
              setError('Invalid or expired reset link. Please request a new password reset.')
              setIsValidToken(false)
            }
          } catch (err) {
            setError('Invalid or expired reset link. Please request a new password reset.')
            setIsValidToken(false)
          }
        } 
        // For query param tokens (from custom email template)
        else if (type === 'recovery' && token) {
          try {
            // Verify the token by calling Supabase's verify endpoint
            const { data, error } = await supabase.auth.verifyOtp({
              token_hash: token,
              type: 'recovery'
            })
            
            if (!error && data.user) {
              setIsValidToken(true)
              // Store the session temporarily for password update
              window.sessionStorage.setItem('recovery_session', JSON.stringify(data.session))
            } else {
              setError('Invalid or expired reset link. Please request a new password reset.')
              setIsValidToken(false)
            }
          } catch (err) {
            setError('Invalid or expired reset link. Please request a new password reset.')
            setIsValidToken(false)
          }
        }
        setCheckingToken(false)
      } else {
        // Check if user has an active session (from Supabase auto-login)
        const { data: { session } } = await supabase.auth.getSession()
        
        if (session?.user?.aud === 'authenticated' && session.user.email) {
          // User is logged in from clicking the reset link - this is valid for password reset
          setIsValidToken(true)
          console.log('User authenticated via reset link, allowing password reset')
        } else {
          setError('Invalid or expired reset link. Please request a new password reset.')
          setIsValidToken(false)
        }
        setCheckingToken(false)
      }
    }

    checkRecoveryToken()
  }, [])

  const validatePassword = (password: string) => {
    if (password.length < 6) {
      return 'Password must be at least 6 characters'
    }
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess(false)

    // Validate passwords
    const passwordError = validatePassword(newPassword)
    if (passwordError) {
      setError(passwordError)
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (updateError) {
        setError(updateError.message)
      } else {
        setSuccess(true)
        // Sign out the user to force them to login with new password
        await supabase.auth.signOut()
        // Redirect to login after 2 seconds
        setTimeout(() => {
          router.push('/login?message=Password reset successfully. Please sign in with your new password.')
        }, 2000)
      }
    } catch (err) {
      setError('An unexpected error occurred')
      console.error('Password reset error:', err)
    } finally {
      setLoading(false)
    }
  }

  if (checkingToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <Card className="w-full max-w-md">
          <CardContent className="py-8">
            <div className="text-center">Verifying reset link...</div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!isValidToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Invalid Reset Link</CardTitle>
            <CardDescription>
              This password reset link is invalid or has expired
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
            <Button 
              onClick={() => router.push('/login')} 
              className="w-full"
            >
              Back to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="h-8 w-8 text-blue-600" />
          </div>
          <CardTitle className="text-2xl">Reset Your Password</CardTitle>
          <CardDescription>
            Choose a new password for your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  disabled={loading}
                  placeholder="Enter new password"
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  tabIndex={-1}
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-gray-500">Minimum 6 characters</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading}
                  placeholder="Confirm new password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            {success && (
              <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-3 rounded">
                <Check className="h-4 w-4" />
                Password reset successfully! Redirecting to login...
              </div>
            )}

            <Button type="submit" disabled={loading || success} className="w-full">
              {loading ? 'Resetting...' : 'Reset Password'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}