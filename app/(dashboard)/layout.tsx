'use client'

import { useAuth } from '@/utils/hooks/use-auth'
import { useUserProfile } from '@/utils/hooks/use-profile'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { NotificationIndicator } from '@/components/notifications/notification-indicator'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, signOut, isAuthenticated } = useAuth()
  const { data: userProfile } = useUserProfile()
  const pathname = usePathname()

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  if (!isAuthenticated) {
    redirect('/login')
  }

  const handleSignOut = async () => {
    await signOut()
    redirect('/')
  }

  const isActivePath = (path: string) => {
    return pathname === path
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-64 bg-white shadow-sm border-r">
        <div className="p-6">
          <h1 className="text-xl font-bold">Job Alerts</h1>
        </div>
        <Separator />
        <nav className="p-4 space-y-2 pb-24">
          <Link href="/dashboard">
            <Button 
              variant={isActivePath('/dashboard') ? 'default' : 'ghost'} 
              className="w-full justify-start"
            >
              Dashboard
            </Button>
          </Link>
          <Link href="/jobs">
            <Button 
              variant={isActivePath('/jobs') ? 'default' : 'ghost'} 
              className="w-full justify-start"
            >
              Jobs
            </Button>
          </Link>
          {userProfile?.account_type === 'admin' && (
            <Link href="/notifications">
              <Button 
                variant={isActivePath('/notifications') ? 'default' : 'ghost'} 
                className="w-full justify-start"
              >
                <NotificationIndicator />
                <span className="ml-2">Notifications (Admin)</span>
              </Button>
            </Link>
          )}
          <Link href="/settings">
            <Button 
              variant={isActivePath('/settings') ? 'default' : 'ghost'} 
              className="w-full justify-start"
            >
              Settings
            </Button>
          </Link>
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t">
          <div className="text-sm text-gray-600 mb-3 text-center">
            {user?.email}
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleSignOut}
            className="w-full"
          >
            Sign Out
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}