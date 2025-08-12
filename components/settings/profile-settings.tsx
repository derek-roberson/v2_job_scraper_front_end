'use client'

import { useState } from 'react'
import { UserProfile, useProfileMutations } from '@/utils/hooks/use-profile'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Save, User, Building2 } from 'lucide-react'

interface ProfileSettingsProps {
  profile?: UserProfile
}

export function ProfileSettings({ profile }: ProfileSettingsProps) {
  const { updateProfile } = useProfileMutations()
  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [company, setCompany] = useState(profile?.company || '')
  const [isEditing, setIsEditing] = useState(false)

  const handleSave = async () => {
    try {
      await updateProfile.mutateAsync({
        full_name: fullName.trim() || undefined,
        company: company.trim() || undefined,
      })
      setIsEditing(false)
    } catch (error) {
      console.error('Failed to update profile:', error)
      alert('Failed to update profile. Please try again.')
    }
  }

  const handleCancel = () => {
    setFullName(profile?.full_name || '')
    setCompany(profile?.company || '')
    setIsEditing(false)
  }

  const hasChanges = fullName !== (profile?.full_name || '') || 
                    company !== (profile?.company || '')

  return (
    <div className="space-y-6">
      {!isEditing ? (
        <div className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-gray-500" />
                  <div>
                    <p className="text-sm font-medium">Full Name</p>
                    <p className="text-sm text-gray-600">
                      {profile?.full_name || 'Not set'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Building2 className="w-5 h-5 text-gray-500" />
                  <div>
                    <p className="text-sm font-medium">Company</p>
                    <p className="text-sm text-gray-600">
                      {profile?.company || 'Not set'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Button onClick={() => setIsEditing(true)}>
            Edit Profile
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                placeholder="Enter your full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                maxLength={255}
              />
              <p className="text-xs text-gray-500">
                Your full name as you&apos;d like it displayed
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="company">Company</Label>
              <Input
                id="company"
                placeholder="Enter your company name"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                maxLength={255}
              />
              <p className="text-xs text-gray-500">
                Current or target company for job searches
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={handleSave}
              disabled={updateProfile.isPending || !hasChanges}
              className="flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {updateProfile.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
            <Button 
              variant="outline" 
              onClick={handleCancel}
              disabled={updateProfile.isPending}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}