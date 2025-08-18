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
    // Check for recovery token validation with retry logic
    const checkRecoveryToken = async () => {
      // Small delay to allow Supabase auth state to settle after redirect
      await new Promise(resolve => setTimeout(resolve, 100))
      
      try {
        // Check current session first
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          console.error('Session error:', sessionError)
          setError('Authentication error. Please try again.')
          setIsValidToken(false)
          setCheckingToken(false)
          return
        }

        if (session?.user?.aud === 'authenticated' && session.user.email) {
          // User is authenticated - likely from clicking the password reset link
          console.log('User authenticated via reset link, allowing password reset')
          setIsValidToken(true)
          setCheckingToken(false)
          return
        }

        // Check for tokens in URL (both hash and query params)
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        const urlParams = new URLSearchParams(window.location.search)
        
        const hashToken = hashParams.get('access_token')
        const hashType = hashParams.get('type')
        const urlToken = urlParams.get('token')
        const urlType = urlParams.get('type')
        
        // Handle hash-based tokens (from Supabase redirect)
        if (hashType === 'recovery' && hashToken) {
          console.log('Processing hash-based recovery token')
          const refreshToken = hashParams.get('refresh_token') || ''
          
          const { error } = await supabase.auth.setSession({
            access_token: hashToken,
            refresh_token: refreshToken
          })
          
          if (!error) {
            setIsValidToken(true)
          } else {
            console.error('Error setting session:', error)
            setError('Invalid or expired reset link. Please request a new password reset.')
            setIsValidToken(false)
          }
        }
        // Handle query param tokens (from custom templates)
        else if (urlType === 'recovery' && urlToken) {
          console.log('Processing URL-based recovery token')
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: urlToken,
            type: 'recovery'
          })
          
          if (!error && data.user) {
            setIsValidToken(true)
          } else {
            console.error('Error verifying token:', error)
            setError('Invalid or expired reset link. Please request a new password reset.')
            setIsValidToken(false)
          }
        }
        else {
          // No valid token or session found
          setError('Invalid or expired reset link. Please request a new password reset.')
          setIsValidToken(false)
        }
        
      } catch (err) {
        console.error('Error checking recovery token:', err)
        setError('An error occurred while validating the reset link. Please try again.')
        setIsValidToken(false)
      } finally {
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