'use client'

import { useState } from 'react'
import { supabase } from '@/utils/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { AlertCircle, Check, Mail } from 'lucide-react'

interface ResetPasswordDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userEmail?: string
}

export function ResetPasswordDialog({ open, onOpenChange, userEmail }: ResetPasswordDialogProps) {
  const [email, setEmail] = useState(userEmail || '')
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
        // Close dialog after 3 seconds
        setTimeout(() => {
          setSuccess(false)
          onOpenChange(false)
        }, 3000)
      }
    } catch (err) {
      setError('An unexpected error occurred')
      console.error('Password reset error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      setEmail(userEmail || '')
      setError('')
      setSuccess(false)
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Reset Password</DialogTitle>
          <DialogDescription>
            We&apos;ll send you an email with instructions to reset your password.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <div className="relative">
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading || !!userEmail}
                placeholder="Enter your email"
                className="pl-10"
              />
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {success && (
            <div className="flex flex-col gap-2 text-sm text-green-600 bg-green-50 p-3 rounded">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4" />
                <span className="font-medium">Password reset email sent!</span>
              </div>
              <p className="text-green-700">
                Check your email for instructions to reset your password. 
                Don&apos;t forget to check your spam folder.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || success}>
              {loading ? 'Sending...' : 'Send Reset Email'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}