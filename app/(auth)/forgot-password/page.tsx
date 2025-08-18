'use client'

import { useState } from 'react'
import { supabase } from '@/utils/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertCircle, Check, Mail, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess(false)

    if (!email) {
      setError('Please enter your email address')
      return
    }

    setLoading(true)

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_FRONTEND_URL}/reset-password`,
      })

      if (resetError) {
        setError(resetError.message)
      } else {
        setSuccess(true)
      }
    } catch (err) {
      setError('An unexpected error occurred')
      console.error('Password reset error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Mail className="h-8 w-8 text-blue-600" />
          </div>
          <CardTitle className="text-2xl">Forgot Your Password?</CardTitle>
          <CardDescription>
            No worries! Enter your email and we&apos;ll send you reset instructions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!success ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  placeholder="Enter your email"
                  className="w-full"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? 'Sending...' : 'Send Reset Instructions'}
              </Button>

              <div className="text-center">
                <Link href="/login" className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1">
                  <ArrowLeft className="h-3 w-3" />
                  Back to Sign In
                </Link>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 text-center">
                <div className="flex items-center justify-center gap-2 text-green-600">
                  <Check className="h-5 w-5" />
                  <span className="font-medium text-lg">Email Sent!</span>
                </div>
                <p className="text-gray-600">
                  We&apos;ve sent password reset instructions to:
                </p>
                <p className="font-semibold text-gray-800">{email}</p>
                <p className="text-sm text-gray-600">
                  Please check your email and follow the link to reset your password.
                  Don&apos;t forget to check your spam folder.
                </p>
              </div>

              <div className="space-y-3">
                <Button 
                  onClick={() => {
                    setSuccess(false)
                    setEmail('')
                  }}
                  variant="outline"
                  className="w-full"
                >
                  Try Another Email
                </Button>
                
                <div className="text-center">
                  <Link href="/login" className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1">
                    <ArrowLeft className="h-3 w-3" />
                    Back to Sign In
                  </Link>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}