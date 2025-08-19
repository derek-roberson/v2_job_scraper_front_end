'use client'

import { useState } from 'react'
import { useAuth } from '@/utils/hooks/use-auth'
import { useUserProfile } from '@/utils/hooks/use-profile'
import { useSubscription } from '@/utils/hooks/use-subscription'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { NotificationIndicator } from '@/components/notifications/notification-indicator'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, signOut, isAuthenticated } = useAuth()
  const { data: userProfile } = useUserProfile()
  const { data: subscription } = useSubscription()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

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
    <div className="flex h-screen bg-gray-100 overflow-x-hidden max-w-full">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white shadow-sm border-r
        transform transition-transform duration-200 ease-in-out lg:transform-none
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Mobile close button */}
        <div className="lg:hidden absolute top-4 right-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-6">
          <h1 className="text-xl font-bold">Job Alerts</h1>
        </div>
        <Separator />
        <nav className="p-4 space-y-2 pb-24">
          <Link href="/dashboard" onClick={() => setSidebarOpen(false)}>
            <Button 
              variant={isActivePath('/dashboard') ? 'default' : 'ghost'} 
              className="w-full justify-start"
            >
              Dashboard
            </Button>
          </Link>
          <Link href="/jobs" onClick={() => setSidebarOpen(false)}>
            <Button 
              variant={isActivePath('/jobs') ? 'default' : 'ghost'} 
              className="w-full justify-start"
            >
              Jobs
            </Button>
          </Link>
          {userProfile?.account_type === 'admin' && (
            <>
              <Link href="/admin" onClick={() => setSidebarOpen(false)}>
                <Button 
                  variant={isActivePath('/admin') ? 'default' : 'ghost'} 
                  className="w-full justify-start"
                >
                  Admin Panel
                </Button>
              </Link>
              <Link href="/notifications" onClick={() => setSidebarOpen(false)}>
                <Button 
                  variant={isActivePath('/notifications') ? 'default' : 'ghost'} 
                  className="w-full justify-start"
                >
                  <NotificationIndicator />
                  <span className="ml-2">Notifications</span>
                </Button>
              </Link>
            </>
          )}
          {/* Hide pricing for privileged users */}
          {!subscription?.isPrivileged && (
            <Link href="/pricing" onClick={() => setSidebarOpen(false)}>
              <Button 
                variant={isActivePath('/pricing') ? 'default' : 'ghost'} 
                className="w-full justify-start"
              >
                Pricing
              </Button>
            </Link>
          )}
          <Link href="/settings" onClick={() => setSidebarOpen(false)}>
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
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Mobile header with menu button */}
        <div className="lg:hidden bg-white border-b p-4 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-4 w-4" />
          </Button>
          <h1 className="text-lg font-semibold">Job Alerts</h1>
          <div className="w-10"></div> {/* Spacer for centering */}
        </div>

        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 lg:p-6 max-w-full">
          {children}
        </main>
      </div>
    </div>
  )
}