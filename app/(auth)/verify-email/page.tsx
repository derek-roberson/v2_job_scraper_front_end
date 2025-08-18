'use client'

import { useState, Suspense } from 'react'
import { supabase } from '@/utils/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

function VerifyEmailContent() {
  const [isResending, setIsResending] = useState(false)
  const [resendMessage, setResendMessage] = useState('')
  const searchParams = useSearchParams()
  const email = searchParams.get('email')

  const handleResendEmail = async () => {
    if (!email) {
      setResendMessage('Email address not found. Please try signing up again.')
      return
    }

    setIsResending(true)
    setResendMessage('')

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: `${process.env.NEXT_PUBLIC_FRONTEND_URL}/dashboard`
        }
      })

      if (error) {
        setResendMessage(`Error: ${error.message}`)
      } else {
        setResendMessage('Verification email sent! Please check your inbox.')
      }
    } catch {
      setResendMessage('Failed to resend email. Please try again later.')
    } finally {
      setIsResending(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Check Your Email</CardTitle>
          <CardDescription>
            We&apos;ve sent you a verification link
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            
            <p className="text-gray-600 mb-4">
              We&apos;ve sent a verification email to:
            </p>
            <p className="font-semibold text-gray-800 mb-6">
              {email || 'your email address'}
            </p>
            
            <p className="text-sm text-gray-600 mb-6">
              Click the link in the email to verify your account and start using Job Alerts.
              If you don&apos;t see the email, check your spam folder.
            </p>
          </div>

          <div className="space-y-3">
            <Button
              onClick={handleResendEmail}
              disabled={isResending || !email}
              variant="outline"
              className="w-full"
            >
              {isResending ? 'Sending...' : 'Resend Verification Email'}
            </Button>

            {resendMessage && (
              <div className={`text-sm text-center px-3 py-2 rounded ${
                resendMessage.startsWith('Error') 
                  ? 'text-red-600 bg-red-50 border border-red-200'
                  : 'text-green-600 bg-green-50 border border-green-200'
              }`}>
                {resendMessage}
              </div>
            )}
          </div>

          <div className="text-center pt-4">
            <Link href="/login" className="text-sm text-blue-600 hover:underline">
              ← Back to sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div>Loading...</div>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  )
}