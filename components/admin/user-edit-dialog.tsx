'use client'

import { useState, useEffect } from 'react'
import { useAdminUserMutations, type AdminUser } from '@/utils/hooks/use-admin'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Crown, Shield, User as UserIcon } from 'lucide-react'

interface UserEditDialogProps {
  user: AdminUser
  open: boolean
  onClose: () => void
  onSave: (updatedUser: AdminUser) => void
}

export function UserEditDialog({ user, open, onClose, onSave }: UserEditDialogProps) {
  const [formData, setFormData] = useState({
    full_name: user.full_name || '',
    account_type: user.account_type,
    subscription_tier: user.subscription_tier,
    max_active_queries: user.max_active_queries
  })
  const [hasChanges, setHasChanges] = useState(false)

  const { updateUser } = useAdminUserMutations()

  // Reset form when user changes
  useEffect(() => {
    setFormData({
      full_name: user.full_name || '',
      account_type: user.account_type,
      subscription_tier: user.subscription_tier,
      max_active_queries: user.max_active_queries
    })
    setHasChanges(false)
  }, [user])

  // Check for changes
  useEffect(() => {
    const hasChanged = 
      formData.full_name !== (user.full_name || '') ||
      formData.account_type !== user.account_type ||
      formData.subscription_tier !== user.subscription_tier ||
      formData.max_active_queries !== user.max_active_queries

    setHasChanges(hasChanged)
  }, [formData, user])

  const handleSave = async () => {
    if (!hasChanges) {
      onClose()
      return
    }

    try {
      const updates: Record<string, unknown> = {}
      
      if (formData.full_name !== (user.full_name || '')) {
        updates.full_name = formData.full_name
      }
      if (formData.account_type !== user.account_type) {
        updates.account_type = formData.account_type
      }
      if (formData.subscription_tier !== user.subscription_tier) {
        updates.subscription_tier = formData.subscription_tier
      }
      if (formData.max_active_queries !== user.max_active_queries) {
        updates.max_active_queries = formData.max_active_queries
      }

      await updateUser.mutateAsync({
        userId: user.id,
        updates
      })

      onSave({ ...user, ...formData })
    } catch (error) {
      console.error('Update failed:', error)
      alert(error instanceof Error ? error.message : 'Failed to update user')
    }
  }

  const getAccountTypeIcon = (accountType: string) => {
    switch (accountType) {
      case 'admin':
        return <Crown className="h-4 w-4 text-yellow-600" />
      case 'privileged':
        return <Shield className="h-4 w-4 text-blue-600" />
      default:
        return <UserIcon className="h-4 w-4 text-gray-500" />
    }
  }

  const getAccountTypeBadge = (accountType: string) => {
    switch (accountType) {
      case 'admin':
        return <Badge className="bg-yellow-500">Admin</Badge>
      case 'privileged':
        return <Badge className="bg-blue-500">Privileged</Badge>
      default:
        return <Badge variant="secondary">Standard</Badge>
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>
            Update user permissions and account details for {user.email}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* User Info */}
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="text-sm font-medium">{user.email}</div>
            <div className="text-xs text-gray-500">
              Created: {new Date(user.created_at).toLocaleDateString()}
            </div>
          </div>

          {/* Full Name */}
          <div className="space-y-2">
            <Label htmlFor="full_name">Full Name</Label>
            <Input
              id="full_name"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              placeholder="Enter full name"
            />
          </div>

          {/* Account Type */}
          <div className="space-y-2">
            <Label>Account Type</Label>
            <div className="flex items-center gap-2">
              {getAccountTypeIcon(formData.account_type)}
              <Select
                value={formData.account_type}
                onValueChange={(value: 'standard' | 'privileged' | 'admin') => 
                  setFormData({ ...formData, account_type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard User</SelectItem>
                  <SelectItem value="privileged">Privileged User</SelectItem>
                  <SelectItem value="admin">Administrator</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="text-xs text-gray-500">
              {formData.account_type === 'admin' && 'Full system access with admin privileges'}
              {formData.account_type === 'privileged' && 'Bypasses subscription limitations'}
              {formData.account_type === 'standard' && 'Standard user with subscription limits'}
            </div>
          </div>

          {/* Subscription Tier */}
          <div className="space-y-2">
            <Label>Subscription Tier</Label>
            <Select
              value={formData.subscription_tier}
              onValueChange={(value: 'free' | 'basic' | 'premium') => 
                setFormData({ ...formData, subscription_tier: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="basic">Basic</SelectItem>
                <SelectItem value="premium">Premium</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Max Active Queries */}
          <div className="space-y-2">
            <Label htmlFor="max_queries">Max Active Queries</Label>
            <Select
              value={formData.max_active_queries.toString()}
              onValueChange={(value) => 
                setFormData({ ...formData, max_active_queries: parseInt(value) })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 Query</SelectItem>
                <SelectItem value="3">3 Queries</SelectItem>
                <SelectItem value="5">5 Queries</SelectItem>
                <SelectItem value="10">10 Queries</SelectItem>
                <SelectItem value="25">25 Queries</SelectItem>
                <SelectItem value="50">50 Queries</SelectItem>
                <SelectItem value="-1">Unlimited</SelectItem>
              </SelectContent>
            </Select>
            <div className="text-xs text-gray-500">
              {formData.max_active_queries === -1 
                ? 'User can create unlimited active queries'
                : `User can have up to ${formData.max_active_queries} active queries`
              }
            </div>
          </div>

          {/* Current Status */}
          <div className="p-3 border rounded-lg">
            <div className="text-sm font-medium mb-2">Current Status</div>
            <div className="flex flex-wrap gap-2">
              {getAccountTypeBadge(user.account_type)}
              {user.subscription_tier && (
                <Badge variant="outline">{user.subscription_tier}</Badge>
              )}
              {user.status && (
                <Badge className="bg-green-500">{user.status}</Badge>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={!hasChanges || updateUser.isPending}
          >
            {updateUser.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}