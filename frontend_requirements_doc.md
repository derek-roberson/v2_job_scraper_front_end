### Custom Hooks (Using Supabase SDK)

```typescript
// lib/hooks/use-queries.ts
// Frontend hooks using standard Supabase SDK - no shared code with Edge Functions
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/use-auth'
import { CreateQueryRequest, UpdateQueryRequest } from '@/types/api'

export function useQueries() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['queries', user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error('User not authenticated')
      
      const { data, error } = await supabase
        .from('queries')
        .select(`
          *,
          us_cities(city, state_name),
          jobs(count)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data
    },
    enabled: !!user?.id,
  })
}

export function useQueryMutations() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const createQuery = useMutation({
    mutationFn: async (newQuery: CreateQueryRequest) => {
      if (!user?.id) throw new Error('User not authenticated')
      
      const { data, error } = await supabase
        .from('queries')
        .insert({
          ...newQuery,
          user_id: user.id,
          is_active: true
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queries'] })
    },
  })

  const updateQuery = useMutation({
    mutationFn: async ({ id, ...updates }: { id: number } & UpdateQueryRequest) => {
      const { data, error } = await supabase
        .from('queries')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queries'] })
    },
  })

  const deleteQuery = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase
        .from('queries')
        .delete()
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queries'] })
    },
  })

  return { createQuery, updateQuery, deleteQuery }
}

// lib/hooks/use-jobs.ts
// Frontend job management using Supabase SDK
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/use-auth'
import { JobFilters } from '@/types/api'

export function useJobs(filters: JobFilters) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['jobs', user?.id, filters],
    queryFn: async () => {
      if (!user?.id) throw new Error('User not authenticated')
      
      let query = supabase
        .from('jobs')
        .select(`
          *,
          queries(keywords)
        `)
        .eq('user_id', user.id)

      // Apply filters using Supabase SDK
      if (filters.search) {
        query = query.or(`title.ilike.%${filters.search}%,company.ilike.%${filters.search}%`)
      }

      if (filters.queryId) {
        query = query.eq('query_id', filters.queryId)
      }

      if (filters.dateRange) {
        query = query
          .gte('posted', filters.dateRange.from.toISOString())
          .lte('posted', filters.dateRange.to.toISOString())
      }

      query = query.order(filters.sortBy, { ascending: filters.sortOrder === 'asc' })

      const { data, error } = await query
      if (error) throw error
      return data
    },
    enabled: !!user?.id,
  })
}

// lib/hooks/use-subscription.ts
// Frontend subscription management using Supabase SDK
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/use-auth'

export function useSubscription() {
  const { user } = useAuth()

  const { data: userProfile, isLoading: profileLoading } = useQuery({
    queryKey: ['user-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error('User not authenticated')
      
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error) throw error
      return data
    },
    enabled: !!user?.id,
  })

  const { data: subscription, isLoading: subscriptionLoading } = useQuery({
    queryKey: ['subscription', user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error('User not authenticated')
      
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (error && error.code !== 'PGRST116') throw error // Ignore "not found" errors
      return data
    },
    enabled: !!user?.id && userProfile?.account_type === 'user',
  })

  const hasAccess = (): boolean => {
    if (!userProfile) return false
    
    // Admin and privileged users always have access
    if (userProfile.account_type === 'admin' || userProfile.account_type === 'privileged') {
      return true
    }
    
    // Regular users need active subscription
    return subscription?.status === 'active'
  }

  const createCheckoutSession = async () => {
    const response = await fetch('/api/stripe/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user?.id,
        email: user?.email
      })
    })

    const { url } = await response.json()
    return url
  }

  const createPortalSession = async () => {
    const response = await fetch('/api/stripe/create-portal-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user?.id
      })
    })

    const { url } = await response.json()
    return url
  }

  return {
    subscription,
    userProfile,
    loading: profileLoading || subscriptionLoading,
    hasAccess: hasAccess(),
    createCheckoutSession,
    createPortalSession,
  }
}

// lib/hooks/use-auth.ts
// Authentication using Supabase Auth SDK
import { useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/stores/auth-store'

export function useAuth() {
  const [loading, setLoading] = useState(true)
  const { user, setUser } = useAuthStore()

  useEffect(() => {
    // Get initial session
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user ?? null)
      setLoading(false)
    }

    getSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null)
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [setUser])

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) throw error
    return data
  }

  const signUp = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) throw error
    return data
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  return {
    user,
    loading,
    signIn,
    signUp,
    signOut,
  }
}

// lib/hooks/use-cities.ts
// Location data using Supabase SDK
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function useStates() {
  return useQuery({
    queryKey: ['us-states'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('us_cities')
        .select('state_name')
        .order('state_name')

      if (error) throw error
      
      // Extract unique state names
      const uniqueStates = [...new Set(data.map(item => item.state_name))].sort()
      return uniqueStates
    },
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
  })
}

export function useCitiesByState(stateName?: string) {
  return useQuery({
    queryKey: ['us-cities', stateName],
    queryFn: async () => {
      if (!stateName) return []
      
      const { data, error } = await supabase
        .from('us_cities')
        .select('id, city, state_name')
        .eq('state_name', stateName)
        .order('city')

      if (error) throw error
      return data
    },
    enabled: !!stateName,
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
  })
}

// lib/hooks/use-notifications.ts
// Notification preferences using Supabase SDK
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/use-auth'

export function useNotificationPreferences() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const { data: preferences, isLoading } = useQuery({
    queryKey: ['notification-preferences', user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error('User not authenticated')
      
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (error && error.code !== 'PGRST116') throw error // Ignore "not found" errors
      return data
    },
    enabled: !!user?.id,
  })

  const updatePreferences = useMutation({
    mutationFn: async (updates: any) => {
      if (!user?.id) throw new Error('User not authenticated')
      
      const { data, error } = await supabase
        .from('notification_preferences')
        .upsert({
          user_id: user.id,
          ...updates,
          updated_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] })
    },
  })

  return {
    preferences,
    isLoading,
    updatePreferences,
  }
}

// lib/hooks/use-realtime.ts
// Real-time subscriptions using Supabase SDK
import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function useRealtimeSubscription(table: string, queryKey: string[]) {
  const queryClient = useQueryClient()

  useEffect(() => {
    const subscription = supabase
      .channel(`realtime:${table}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: table,
        },
        (payload) => {
          console.log('Real-time update:', payload)
          
          // Invalidate and refetch queries
          queryClient.invalidateQueries({ queryKey })
          
          // Show toast notification for new jobs
          if (payload.eventType === 'INSERT' && table === 'jobs') {
            // Show# LinkedIn Job Scraper - Frontend Engineering Requirements Document

## Project Overview

A modern web application for automated LinkedIn job searching with a professional dashboard interface similar to Datadog. Built with Next.js 14, Turbo for build optimization, and deployed on Vercel.

## Technology Stack

### Core Framework
- **Framework**: Next.js 14 with App Router
- **Build Tool**: Turbo (Turbopack for dev, optimized builds)
- **Deployment**: Vercel with automatic deployments
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui

### State Management & Data
- **Authentication**: Supabase Auth SDK
- **Database**: Supabase SDK for client-side integration
- **State Management**: Zustand for global state
- **Data Fetching**: TanStack Query (React Query)
- **Form Handling**: React Hook Form with Zod validation

### Backend Integration
- **Database Access**: Supabase JavaScript SDK
- **Real-time**: Supabase Realtime subscriptions
- **Authentication**: Supabase Auth helpers for Next.js
- **File Storage**: Supabase Storage (if needed)
- **No Code Sharing**: Frontend uses SDK, Edge Functions are completely separate

### Monitoring & Analytics
- **Error Tracking**: Sentry
- **Analytics**: Vercel Analytics + Posthog
- **Performance**: Vercel Speed Insights

## Project Structure

```
src/
├── web_app/
│   ├── (auth)/                       # Auth layout group
│   │   ├── login/
│   │   │   └── page.tsx
│   │   └── layout.tsx               # Auth-specific layout
│   ├── (dashboard)/                 # Main dashboard layout group
│   │   ├── dashboard/
│   │   │   └── page.tsx            # Query management
│   │   ├── jobs/
│   │   │   ├── page.tsx            # Job search results
│   │   │   └── [id]/
│   │   │       └── page.tsx        # Job details
│   │   ├── analytics/
│   │   │   └── page.tsx            # Performance analytics
│   │   ├── settings/
│   │   │   ├── page.tsx            # Account settings
│   │   │   ├── notifications/
│   │   │   │   └── page.tsx        # Notification preferences
│   │   │   └── billing/
│   │   │       └── page.tsx        # Subscription management
│   │   ├── admin/                  # Admin-only section
│   │   │   ├── page.tsx           # Admin dashboard
│   │   │   ├── users/
│   │   │   │   └── page.tsx       # User management
│   │   │   └── system/
│   │   │       └── page.tsx       # System monitoring
│   │   └── layout.tsx             # Dashboard layout with sidebar
│   ├── api/                       # API routes
│   │   ├── webhooks/
│   │   │   └── stripe/
│   │   │       └── route.ts
│   │   └── health/
│   │       └── route.ts
│   ├── globals.css               # Global styles
│   ├── layout.tsx               # Root layout
│   └── page.tsx                 # Landing page
├── components/
│   ├── ui/                      # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   ├── table.tsx
│   │   ├── chart.tsx
│   │   └── ...
│   ├── layout/                  # Layout components
│   │   ├── sidebar.tsx         # Main navigation sidebar
│   │   ├── header.tsx          # Top header bar
│   │   ├── breadcrumbs.tsx     # Navigation breadcrumbs
│   │   ├── user-menu.tsx       # User dropdown menu
│   │   └── search-bar.tsx      # Global search
│   ├── dashboard/              # Dashboard-specific components
│   │   ├── stats-cards.tsx     # KPI stat cards
│   │   ├── query-list.tsx      # Query management list
│   │   ├── recent-jobs.tsx     # Recent job discoveries
│   │   ├── system-status.tsx   # System health indicators
│   │   └── activity-feed.tsx   # Real-time activity updates
│   ├── jobs/                   # Job-related components
│   │   ├── job-card.tsx        # Individual job display
│   │   ├── job-table.tsx       # Tabular job view
│   │   ├── job-filters.tsx     # Search and filter controls
│   │   ├── job-export.tsx      # Export functionality
│   │   └── job-details.tsx     # Detailed job view
│   ├── queries/                # Query management components
│   │   ├── query-card.tsx      # Query display card
│   │   ├── create-query.tsx    # Query creation form
│   │   ├── edit-query.tsx      # Query editing form
│   │   ├── query-stats.tsx     # Query performance metrics
│   │   └── location-selector.tsx # Geographic selection
│   ├── analytics/              # Analytics and reporting
│   │   ├── performance-chart.tsx
│   │   ├── success-rate-chart.tsx
│   │   ├── job-trends-chart.tsx
│   │   └── metrics-summary.tsx
│   ├── settings/               # Settings components
│   │   ├── profile-form.tsx
│   │   ├── notification-settings.tsx
│   │   ├── billing-info.tsx
│   │   └── api-keys.tsx
│   ├── admin/                  # Admin components
│   │   ├── user-table.tsx
│   │   ├── system-metrics.tsx
│   │   ├── error-logs.tsx
│   │   └── feature-flags.tsx
│   └── common/                 # Shared components
│       ├── loading-spinner.tsx
│       ├── error-boundary.tsx
│       ├── empty-state.tsx
│       ├── confirmation-dialog.tsx
│       └── status-badge.tsx
├── lib/
│   ├── auth.ts                 # Authentication utilities
│   ├── supabase.ts            # Supabase client setup
│   ├── utils.ts               # General utilities
│   ├── validations.ts         # Zod schemas
│   ├── constants.ts           # App constants
│   ├── hooks/                 # Custom React hooks
│   │   ├── use-auth.ts
│   │   ├── use-queries.ts
│   │   ├── use-jobs.ts
│   │   ├── use-subscription.ts
│   │   └── use-local-storage.ts
│   └── stores/                # Zustand stores
│       ├── auth-store.ts
│       ├── ui-store.ts
│       └── preferences-store.ts
├── types/
│   ├── database.ts            # Database type definitions
│   ├── api.ts                 # API type definitions
│   └── index.ts               # Exported types
└── styles/
    └── globals.css            # Additional global styles
```

## Design System & UI Components

### Color Palette (Professional SaaS Theme)

```css
/* Primary Brand Colors */
:root {
  --primary-50: #eff6ff;
  --primary-100: #dbeafe;
  --primary-500: #3b82f6;    /* Main brand blue */
  --primary-600: #2563eb;
  --primary-700: #1d4ed8;
  --primary-900: #1e3a8a;
  
  /* Neutral Grays */
  --gray-50: #f9fafb;
  --gray-100: #f3f4f6;
  --gray-200: #e5e7eb;
  --gray-300: #d1d5db;
  --gray-400: #9ca3af;
  --gray-500: #6b7280;
  --gray-600: #4b5563;
  --gray-700: #374151;
  --gray-800: #1f2937;
  --gray-900: #111827;
  
  /* Status Colors */
  --success-500: #10b981;    /* Green for success states */
  --warning-500: #f59e0b;    /* Amber for warnings */
  --error-500: #ef4444;      /* Red for errors */
  --info-500: #06b6d4;       /* Cyan for info */
}

/* Dark mode support */
[data-theme="dark"] {
  --background: var(--gray-900);
  --foreground: var(--gray-50);
  --sidebar-bg: var(--gray-800);
  --card-bg: var(--gray-800);
}
```

### Layout Specifications

#### Sidebar Navigation Configuration
```typescript
interface SidebarItem {
  id: string
  label: string
  icon: React.ComponentType
  href: string
  badge?: string | number
  children?: SidebarItem[]
  permission?: 'admin' | 'user'
}

const SIDEBAR_CONFIG: SidebarItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: Home,
    href: '/dashboard'
  },
  {
    id: 'queries',
    label: 'Job Queries',
    icon: Search,
    href: '/dashboard',
    badge: 'active_queries_count'
  },
  {
    id: 'jobs',
    label: 'Discovered Jobs',
    icon: Briefcase,
    href: '/jobs',
    badge: 'new_jobs_count'
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: TrendingUp,
    href: '/analytics'
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    href: '/settings',
    children: [
      {
        id: 'profile',
        label: 'Profile',
        icon: User,
        href: '/settings'
      },
      {
        id: 'notifications',
        label: 'Notifications',
        icon: Bell,
        href: '/settings/notifications'
      },
      {
        id: 'billing',
        label: 'Billing',
        icon: CreditCard,
        href: '/settings/billing'
      }
    ]
  },
  {
    id: 'admin',
    label: 'Admin',
    icon: Shield,
    href: '/admin',
    permission: 'admin',
    children: [
      {
        id: 'users',
        label: 'Users',
        icon: Users,
        href: '/admin/users'
      },
      {
        id: 'system',
        label: 'System',
        icon: Activity,
        href: '/admin/system'
      }
    ]
  }
]
```

#### Responsive Breakpoints
```css
/* Tailwind custom breakpoints */
module.exports = {
  theme: {
    screens: {
      'xs': '475px',
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1536px',
    }
  }
}
```

## Page Specifications

### 1. Dashboard Page (`/dashboard`)

**Purpose**: Main overview page with system status and key metrics

**Layout**: Full-width dashboard with sidebar navigation

```typescript
// app/(dashboard)/dashboard/page.tsx
export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500">
            Overview of your job search automation
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <RefreshButton />
          <TimeRangeSelector />
        </div>
      </div>

      {/* KPI Stats Cards */}
      <StatsCards />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <QueryList />
        </div>
        <div className="space-y-6">
          <SystemStatus />
          <RecentJobs />
        </div>
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <ActivityFeed />
        <PerformanceChart />
      </div>
    </div>
  )
}
```

**Key Features**:
- Real-time KPI cards (active queries, jobs found today, success rate)
- Query management with inline actions
- System status indicators
- Recent job discoveries
- Performance analytics charts
- Activity feed with real-time updates

### 2. Jobs Page (`/jobs`)

**Purpose**: Browse and manage discovered job listings

**Layout**: Full-width table with advanced filtering

```typescript
// app/(dashboard)/jobs/page.tsx
export default function JobsPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Job Discoveries</h1>
          <p className="text-gray-500">
            Browse and manage your discovered job opportunities
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <JobExportButton />
          <Button>View Analytics</Button>
        </div>
      </div>

      {/* Filters & Search */}
      <JobFilters />

      {/* Results Summary */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">
              Showing {filteredJobs.length} of {totalJobs} jobs
            </span>
            <SortDropdown />
          </div>
          <ViewToggle /> {/* Table vs Grid view */}
        </div>
      </div>

      {/* Job Results */}
      <JobTable />
      
      {/* Pagination */}
      <Pagination />
    </div>
  )
}
```

**Key Features**:
- Advanced filtering (date range, query, company, location)
- Search across job titles and descriptions
- Sortable table with pagination
- Bulk actions (mark as applied, delete, export)
- Grid and table view options
- Job details modal/page
- Export to CSV/JSON

### 3. Analytics Page (`/analytics`)

**Purpose**: Performance metrics and insights

```typescript
// app/(dashboard)/analytics/page.tsx
export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-500">
            Performance insights and trends
          </p>
        </div>
        <TimeRangeSelector />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Jobs Found"
          value={totalJobs}
          change="+12%"
          trend="up"
        />
        <MetricCard
          title="Success Rate"
          value="94.2%"
          change="+2.1%"
          trend="up"
        />
        <MetricCard
          title="Avg Jobs/Query"
          value="8.5"
          change="-0.3"
          trend="down"
        />
        <MetricCard
          title="Active Queries"
          value={activeQueries}
          change="+3"
          trend="up"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <JobTrendsChart />
        <SuccessRateChart />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <TopCompaniesChart />
        <QueryPerformanceTable />
      </div>
    </div>
  )
}
```

### 4. Settings Pages

#### Main Settings (`/settings`)
```typescript
// app/(dashboard)/settings/page.tsx
export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Account Settings</h1>
        <p className="text-gray-500">
          Manage your account information and preferences
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ProfileForm />
        </div>
        <div className="space-y-6">
          <AccountInfo />
          <DangerZone />
        </div>
      </div>
    </div>
  )
}
```

#### Notifications Settings (`/settings/notifications`)
```typescript
// app/(dashboard)/settings/notifications/page.tsx
export default function NotificationSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Notification Settings</h1>
        <p className="text-gray-500">
          Configure how you want to be notified about new job discoveries
        </p>
      </div>

      <div className="space-y-6">
        <EmailNotifications />
        <WebPushNotifications />
        <WebhookNotifications />
        <NotificationFrequency />
      </div>
    </div>
  )
}
```

### 5. Admin Pages (Admin Users Only)

#### Admin Dashboard (`/admin`)
```typescript
// app/(dashboard)/admin/page.tsx
export default function AdminDashboardPage() {
  const { user } = useAuth()
  
  // Redirect if not admin
  if (user?.account_type !== 'admin') {
    redirect('/dashboard')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">System Administration</h1>
        <p className="text-gray-500">
          Monitor system health and manage users
        </p>
      </div>

      {/* System Health Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <SystemHealthCard
          title="Total Users"
          value={systemStats.totalUsers}
          status="healthy"
        />
        <SystemHealthCard
          title="Active Subscriptions"
          value={systemStats.activeSubscriptions}
          status="healthy"
        />
        <SystemHealthCard
          title="Hourly Success Rate"
          value="96.8%"
          status="healthy"
        />
        <SystemHealthCard
          title="System Load"
          value="Moderate"
          status="warning"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <RecentErrors />
        <UserGrowthChart />
      </div>
    </div>
  )
}
```

## Component Library

### Core Components

#### 1. Sidebar Navigation
```typescript
// components/layout/sidebar.tsx
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

export function Sidebar({ className }: { className?: string }) {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()

  return (
    <div className={cn(
      "flex flex-col bg-gray-900 text-white transition-all duration-300",
      collapsed ? "w-16" : "w-64",
      className
    )}>
      {/* Logo */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        {!collapsed && (
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">JS</span>
            </div>
            <span className="font-semibold">Job Scraper</span>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className="text-gray-400 hover:text-white"
        >
          <ChevronLeft className={cn(
            "h-4 w-4 transition-transform",
            collapsed && "rotate-180"
          )} />
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {SIDEBAR_CONFIG.map((item) => (
          <SidebarItem
            key={item.id}
            item={item}
            collapsed={collapsed}
            pathname={pathname}
          />
        ))}
      </nav>

      {/* User Menu */}
      <div className="p-4 border-t border-gray-800">
        <UserMenu collapsed={collapsed} />
      </div>
    </div>
  )
}

function SidebarItem({ item, collapsed, pathname }: {
  item: SidebarItem
  collapsed: boolean
  pathname: string
}) {
  const isActive = pathname === item.href
  const hasChildren = item.children && item.children.length > 0
  const [expanded, setExpanded] = useState(false)

  return (
    <div>
      <Link
        href={item.href}
        className={cn(
          "flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
          isActive 
            ? "bg-blue-600 text-white" 
            : "text-gray-300 hover:bg-gray-800 hover:text-white",
          collapsed && "justify-center"
        )}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        <item.icon className="h-5 w-5 flex-shrink-0" />
        {!collapsed && (
          <>
            <span className="flex-1">{item.label}</span>
            {item.badge && (
              <Badge variant="secondary" className="ml-auto">
                {item.badge}
              </Badge>
            )}
            {hasChildren && (
              <ChevronDown className={cn(
                "h-4 w-4 transition-transform",
                expanded && "rotate-180"
              )} />
            )}
          </>
        )}
      </Link>

      {/* Sub-navigation */}
      {hasChildren && expanded && !collapsed && (
        <div className="ml-6 mt-2 space-y-1">
          {item.children.map((child) => (
            <Link
              key={child.id}
              href={child.href}
              className={cn(
                "flex items-center space-x-3 px-3 py-2 rounded-lg text-sm transition-colors",
                pathname === child.href
                  ? "bg-blue-500 text-white"
                  : "text-gray-400 hover:bg-gray-800 hover:text-white"
              )}
            >
              <child.icon className="h-4 w-4" />
              <span>{child.label}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
```

#### 2. Stats Cards Component
```typescript
// components/dashboard/stats-cards.tsx
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface StatCard {
  title: string
  value: string | number
  change?: {
    value: string
    trend: 'up' | 'down' | 'neutral'
  }
  icon: React.ComponentType<{ className?: string }>
  color: 'blue' | 'green' | 'yellow' | 'red'
}

export function StatsCards() {
  const { data: stats, isLoading } = useStats()

  const statCards: StatCard[] = [
    {
      title: 'Active Queries',
      value: stats?.activeQueries || 0,
      change: {
        value: '+2',
        trend: 'up'
      },
      icon: Search,
      color: 'blue'
    },
    {
      title: 'Jobs Found Today',
      value: stats?.jobsFoundToday || 0,
      change: {
        value: '+23%',
        trend: 'up'
      },
      icon: Briefcase,
      color: 'green'
    },
    {
      title: 'Success Rate',
      value: `${stats?.successRate || 0}%`,
      change: {
        value: '-0.5%',
        trend: 'down'
      },
      icon: Activity,
      color: 'yellow'
    },
    {
      title: 'Total Jobs Found',
      value: stats?.totalJobs || 0,
      icon: Target,
      color: 'blue'
    }
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {statCards.map((stat, index) => (
        <Card key={index} className="relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              {stat.title}
            </CardTitle>
            <div className={cn(
              "p-2 rounded-lg",
              stat.color === 'blue' && "bg-blue-100 text-blue-600",
              stat.color === 'green' && "bg-green-100 text-green-600",
              stat.color === 'yellow' && "bg-yellow-100 text-yellow-600",
              stat.color === 'red' && "bg-red-100 text-red-600"
            )}>
              <stat.icon className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {isLoading ? (
                <div className="h-8 w-16 bg-gray-200 rounded animate-pulse" />
              ) : (
                stat.value
              )}
            </div>
            {stat.change && (
              <div className="flex items-center space-x-1 mt-1">
                {stat.change.trend === 'up' && (
                  <TrendingUp className="h-3 w-3 text-green-500" />
                )}
                {stat.change.trend === 'down' && (
                  <TrendingDown className="h-3 w-3 text-red-500" />
                )}
                {stat.change.trend === 'neutral' && (
                  <Minus className="h-3 w-3 text-gray-500" />
                )}
                <span className={cn(
                  "text-xs font-medium",
                  stat.change.trend === 'up' && "text-green-600",
                  stat.change.trend === 'down' && "text-red-600",
                  stat.change.trend === 'neutral' && "text-gray-600"
                )}>
                  {stat.change.value}
                </span>
                <span className="text-xs text-gray-500">from last week</span>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
```

#### 3. Job Card Component
```typescript
// components/jobs/job-card.tsx
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { ExternalLink, MapPin, Calendar, Building } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface JobCardProps {
  job: {
    id: number
    title: string
    company: string
    location: string
    link: string
    posted: string
    query?: {
      keywords: string
    }
  }
  onMarkAsApplied?: (jobId: number) => void
  onSave?: (jobId: number) => void
}

export function JobCard({ job, onMarkAsApplied, onSave }: JobCardProps) {
  const timeAgo = formatDistanceToNow(new Date(job.posted), { addSuffix: true })

  const handleOpenJob = () => {
    window.open(job.link, '_blank', 'noopener,noreferrer')
  }

  return (
    <Card className="group hover:shadow-md transition-all duration-200 border-l-4 border-l-blue-500">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1 mr-4">
            <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors leading-tight">
              {job.title}
            </h3>
            <div className="flex items-center space-x-4 text-sm text-gray-600">
              <div className="flex items-center space-x-1">
                <Building className="h-3 w-3" />
                <span className="font-medium">{job.company}</span>
              </div>
              <div className="flex items-center space-x-1">
                <MapPin className="h-3 w-3" />
                <span>{job.location}</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              size="sm"
              onClick={handleOpenJob}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ExternalLink className="h-4 w-4 mr-1" />
              View
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1 text-sm text-gray-500">
              <Calendar className="h-3 w-3" />
              <span>{timeAgo}</span>
            </div>
            {job.query && (
              <Badge variant="outline" className="text-xs">
                {job.query.keywords}
              </Badge>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {onSave && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSave(job.id)}
              >
                Save
              </Button>
            )}
            {onMarkAsApplied && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onMarkAsApplied(job.id)}
              >
                Mark Applied
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
```

#### 4. Query Management Component
```typescript
// components/dashboard/query-list.tsx
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { MoreHorizontal, Edit, Trash2, TrendingUp, Clock, MapPin, Plus } from 'lucide-react'

export function QueryList() {
  const { data: queries, isLoading } = useQueries()
  const { updateQuery, deleteQuery } = useQueryMutations()
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  const handleToggleActive = async (queryId: number, isActive: boolean) => {
    await updateQuery.mutateAsync({ id: queryId, is_active: isActive })
  }

  const handleDelete = async (queryId: number) => {
    if (confirm('Are you sure you want to delete this query?')) {
      await deleteQuery.mutateAsync(queryId)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Job Search Queries</CardTitle>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Query
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : queries?.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-gray-500 mb-4">
              No job queries configured yet
            </div>
            <Button onClick={() => setShowCreateDialog(true)}>
              Create Your First Query
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {queries?.map((query) => (
              <QueryCard
                key={query.id}
                query={query}
                onToggleActive={handleToggleActive}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}

        <CreateQueryDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
        />
      </CardContent>
    </Card>
  )
}

function QueryCard({ query, onToggleActive, onDelete }: {
  query: Query
  onToggleActive: (id: number, active: boolean) => void
  onDelete: (id: number) => void
}) {
  const workTypeLabels = {
    1: 'On-site',
    2: 'Remote',
    3: 'Hybrid'
  }

  return (
    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
      <div className="flex-1 space-y-2">
        <div className="flex items-center space-x-3">
          <h4 className="font-medium text-gray-900">{query.keywords}</h4>
          <div className="flex space-x-1">
            {query.work_types.map((type) => (
              <Badge key={type} variant="secondary" className="text-xs">
                {workTypeLabels[type as keyof typeof workTypeLabels]}
              </Badge>
            ))}
          </div>
        </div>
        
        <div className="flex items-center space-x-6 text-sm text-gray-600">
          <div className="flex items-center space-x-1">
            <MapPin className="h-3 w-3" />
            <span>{query.location_string || 'Global'}</span>
          </div>
          <div className="flex items-center space-x-1">
            <TrendingUp className="h-3 w-3" />
            <span>{query.jobCount || 0} jobs found</span>
          </div>
          <div className="flex items-center space-x-1">
            <Clock className="h-3 w-3" />
            <span>Last run: {query.lastRun ? formatDistanceToNow(new Date(query.lastRun), { addSuffix: true }) : 'Never'}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600">Active</span>
          <Switch
            checked={query.is_active}
            onCheckedChange={(checked) => onToggleActive(query.id, checked)}
          />
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => onDelete(query.id)}
              className="text-red-600"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
```

#### 5. System Status Component
```typescript
// components/dashboard/system-status.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Activity, CheckCircle, AlertCircle, XCircle } from 'lucide-react'

interface SystemService {
  name: string
  status: 'operational' | 'degraded' | 'down'
  lastCheck: string
  responseTime?: number
}

export function SystemStatus() {
  const { data: systemHealth } = useSystemHealth()

  const services: SystemService[] = [
    {
      name: 'Job Processor',
      status: systemHealth?.jobProcessor || 'operational',
      lastCheck: '2 minutes ago',
      responseTime: 1.2
    },
    {
      name: 'Database',
      status: systemHealth?.database || 'operational',
      lastCheck: '1 minute ago',
      responseTime: 0.8
    },
    {
      name: 'Notifications',
      status: systemHealth?.notifications || 'operational',
      lastCheck: '3 minutes ago',
      responseTime: 2.1
    },
    {
      name: 'LinkedIn Scraper',
      status: systemHealth?.scraper || 'operational',
      lastCheck: '5 minutes ago',
      responseTime: 3.5
    }
  ]

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'operational':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'degraded':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />
      case 'down':
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <Activity className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'operational':
        return <Badge className="bg-green-100 text-green-800">Operational</Badge>
      case 'degraded':
        return <Badge className="bg-yellow-100 text-yellow-800">Degraded</Badge>
      case 'down':
        return <Badge className="bg-red-100 text-red-800">Down</Badge>
      default:
        return <Badge variant="secondary">Unknown</Badge>
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Activity className="h-5 w-5" />
          <span>System Status</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {services.map((service) => (
            <div key={service.name} className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {getStatusIcon(service.status)}
                <div>
                  <div className="font-medium text-sm">{service.name}</div>
                  <div className="text-xs text-gray-500">
                    Last check: {service.lastCheck}
                  </div>
                </div>
              </div>
              <div className="text-right space-y-1">
                {getStatusBadge(service.status)}
                {service.responseTime && (
                  <div className="text-xs text-gray-500">
                    {service.responseTime}s
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Overall Status</span>
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="font-medium text-green-600">All Systems Operational</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
```

## State Management

### Zustand Stores

```typescript
// lib/stores/auth-store.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface User {
  id: string
  email: string
  account_type: 'admin' | 'privileged' | 'user'
  full_name?: string
}

interface AuthState {
  user: User | null
  isLoading: boolean
  setUser: (user: User | null) => void
  setLoading: (loading: boolean) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isLoading: true,
      setUser: (user) => set({ user }),
      setLoading: (isLoading) => set({ isLoading }),
      logout: () => set({ user: null }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user }),
    }
  )
)

// lib/stores/ui-store.ts
import { create } from 'zustand'

interface UIState {
  sidebarCollapsed: boolean
  theme: 'light' | 'dark'
  setSidebarCollapsed: (collapsed: boolean) => void
  setTheme: (theme: 'light' | 'dark') => void
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  theme: 'light',
  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
  setTheme: (theme) => set({ theme }),
}))
```

### Custom Hooks (Updated for Independent Frontend)

```typescript
// lib/hooks/use-queries.ts
// Frontend-only hooks with no shared backend code
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/supabase-client'
import { useAuthStore } from '@/lib/stores/auth-store'
import { CreateQueryRequest, UpdateQueryRequest } from '@/types/api'

export function useQueries() {
  const { user } = useAuthStore()

  return useQuery({
    queryKey: ['queries', user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error('User not authenticated')
      
### Environment Configuration (Frontend Only)

```bash
# .env.local - Frontend environment variables only
# No shared environment with Supabase backend

# Supabase Frontend Client Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Stripe Frontend Configuration
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_...

# Frontend App Configuration
NEXT_PUBLIC_APP_URL=https://yourdomain.com
NEXT_PUBLIC_APP_NAME="LinkedIn Job Scraper"

# Analytics & Monitoring (Frontend Only)
NEXT_PUBLIC_SENTRY_DSN=your-sentry-dsn
NEXT_PUBLIC_POSTHOG_KEY=your-posthog-key
NEXT_PUBLIC_VERCEL_ANALYTICS_ID=your-analytics-id

# Feature Flags
NEXT_PUBLIC_ENABLE_ANALYTICS=true
NEXT_PUBLIC_ENABLE_DARK_MODE=true
NEXT_PUBLIC_ENABLE_EXPORT=true
```

### Independent Deployment Strategy

#### Vercel Configuration (Frontend Only)
```json
// vercel.json - Frontend deployment configuration
{
  "framework": "nextjs",
  "buildCommand": "next build",
  "devCommand": "next dev --turbo",
  "installCommand": "npm install",
  "functions": {
    "app/api/**": {
      "maxDuration": 30
    }
  },
  "env": {
    "NEXT_PUBLIC_SUPABASE_URL": "@supabase-url",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY": "@supabase-anon-key",
    "STRIPE_SECRET_KEY": "@stripe-secret-key",
    "STRIPE_WEBHOOK_SECRET": "@stripe-webhook-secret",
    "STRIPE_PRICE_ID": "@stripe-price-id"
  },
  "build": {
    "env": {
      "NEXT_TELEMETRY_DISABLED": "1"
    }
  },
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        }
      ]
    }
  ],
  "redirects": [
    {
      "source": "/admin/:path*",
      "has": [
        {
          "type": "header",
          "key": "authorization",
          "value": "(?<token>.*)"
        }
      ],
      "destination": "/unauthorized",
      "permanent": false
    }
  ]
}
```

### Frontend-Only Package.json

```json
{
  "name": "linkedin-job-scraper-frontend",
  "version": "1.0.0",
  "private": true,
  "description": "Frontend dashboard for LinkedIn Job Scraper",
  "scripts": {
    "dev": "next dev --turbo",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "lint:fix": "next lint --fix",
    "type-check": "tsc --noEmit",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:e2e": "playwright test",
    "analyze": "ANALYZE=true next build",
    "preview": "next build && next start",
    "clean": "rm -rf .next out node_modules/.cache"
  },
  "dependencies": {
    "next": "^14.1.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "typescript": "^5.3.0",
    
    "# Supabase Client (Frontend Only)": "",
    "@supabase/auth-helpers-nextjs": "^0.8.7",
    "@supabase/supabase-js": "^2.39.0",
    
    "# State Management": "",
    "@tanstack/react-query": "^5.17.0",
    "zustand": "^4.4.7",
    
    "# Forms & Validation": "",
    "react-hook-form": "^7.49.0",
    "zod": "^3.22.4",
    "@hookform/resolvers": "^3.3.2",
    
    "# UI & Styling": "",
    "tailwindcss": "^3.4.0",
    "@tailwindcss/typography": "^0.5.10",
    "lucide-react": "^0.312.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.0",
    
    "# Date & Time": "",
    "date-fns": "^3.2.0",
    
    "# Charts & Visualization": "",
    "recharts": "^2.10.0",
    
    "# Payment Processing": "",
    "stripe": "^14.15.0",
    
    "# Monitoring & Analytics": "",
    "@sentry/nextjs": "^7.99.0",
    "@vercel/analytics": "^1.1.0",
    "posthog-js": "^1.100.0"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "@types/react": "^18.2.48",
    "@types/react-dom": "^18.2.18",
    
    "# Linting & Formatting": "",
    "eslint": "^8.56.0",
    "eslint-config-next": "^14.1.0",
    "@typescript-eslint/eslint-plugin": "^6.19.0",
    "@typescript-eslint/parser": "^6.19.0",
    "prettier": "^3.2.4",
    "prettier-plugin-tailwindcss": "^0.5.11",
    
    "# Testing": "",
    "@testing-library/react": "^14.1.2",
    "@testing-library/jest-dom": "^6.2.0",
    "@testing-library/user-event": "^14.5.2",
    "jest": "^29.7.0",
    "jest-environment-jsdom": "^29.7.0",
    "@playwright/test": "^1.41.0",
    
    "# Build Tools": "",
    "@next/bundle-analyzer": "^14.1.0",
    "cross-env": "^7.0.3"
  },
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=9.0.0"
  }
}
```

### Development Workflow (Frontend Independent)

```bash
# Frontend development commands
npm run dev          # Start development server with Turbo
npm run build        # Build for production
npm run type-check   # TypeScript type checking
npm run lint         # ESLint checking
npm run test         # Run unit tests
npm run test:e2e     # Run end-to-end tests
npm run analyze      # Bundle analysis

# Frontend-only deployment
vercel               # Deploy to Vercel
vercel --prod        # Deploy to production

# No shared commands with backend
# Backend is deployed separately via Supabase CLI
```

### API Communication Strategy

```typescript
// lib/api-client.ts
// Frontend API client for communicating with backend
// No shared code - pure REST API communication

export class ApiClient {
  private baseUrl: string
  private headers: Record<string, string>

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    this.headers = {
      'Content-Type': 'application/json',
      'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    }
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    
    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.headers,
        ...options.headers,
      },
    })

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`)
    }

    return response.json()
  }

  // Authentication endpoints
  auth = {
    signIn: (email: string, password: string) =>
      this.request('/auth/v1/token?grant_type=password', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),

    signUp: (email: string, password: string) =>
      this.request('/auth/v1/signup', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),

    signOut: (token: string) =>
      this.request('/auth/v1/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }),
  }

  // Data endpoints (REST API)
  queries = {
    list: (userId: string, token: string) =>
      this.request(`/rest/v1/queries?user_id=eq.${userId}&select=*`, {
        headers: { Authorization: `Bearer ${token}` },
      }),

    create: (data: any, token: string) =>
      this.request('/rest/v1/queries', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      }),

    update: (id: number, data: any, token: string) =>
      this.request(`/rest/v1/queries?id=eq.${id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      }),

    delete: (id: number, token: string) =>
      this.request(`/rest/v1/queries?id=eq.${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }),
  }

  // Jobs endpoints
  jobs = {
    list: (userId: string, filters: any, token: string) => {
      const params = new URLSearchParams({
        user_id: `eq.${userId}`,
        select: '*,queries(keywords)',
        order: `${filters.sortBy}.${filters.sortOrder}`,
      })

      if (filters.search) {
        params.append('or', `title.ilike.*${filters.search}*,company.ilike.*${filters.search}*`)
      }

      return this.request(`/rest/v1/jobs?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    },
  }

  // System health endpoints
  system = {
    health: () =>
      this.request('/rest/v1/rpc/system_health'),

    stats: (userId: string, token: string) =>
      this.request(`/rest/v1/rpc/dashboard_stats?user_id=${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
  }
}

export const apiClient = new ApiClient()
```

### Type Safety Without Code Sharing

```typescript
// types/api-contracts.ts
// Frontend-defined API contracts that should match backend
// These are manually maintained to stay in sync

export interface ApiResponse<T> {
  data: T
  error: null
}

export interface ApiError {
  data: null
  error: {
    message: string
    code: string
    details?: any
  }
}

export interface CreateQueryRequest {
  keywords: string
  work_types: number[]
  city_id?: number
  location_string?: string
}

export interface UpdateQueryRequest {
  keywords?: string
  work_types?: number[]
  city_id?: number
  location_string?: string
  is_active?: boolean
}

export interface JobFilters {
  search?: string
  queryId?: number
  dateRange?: { from: Date; to: Date }
  sortBy: 'posted' | 'company' | 'title'
  sortOrder: 'asc' | 'desc'
  limit?: number
  offset?: number
}

export interface DashboardStats {
  activeQueries: number
  jobsFoundToday: number
  totalJobs: number
  successRate: number
  lastProcessingTime?: string
}

export interface SystemHealthStatus {
  jobProcessor: 'operational' | 'degraded' | 'down'
  database: 'operational' | 'degraded' | 'down'
  notifications: 'operational' | 'degraded' | 'down'
  scraper: 'operational' | 'degraded' | 'down'
  lastUpdated: string
}

// Webhook payload types (for frontend webhook handlers)
export interface StripeWebhookEvent {
  id: string
  type: string
  data: {
    object: any
  }
  created: number
}

// Notification payload types
export interface NotificationPayload {
  userId: string
  type: 'new_jobs' | 'query_complete' | 'system_alert'
  data: any
  timestamp: string
}
``` } = await api.queries.list(user.id)
      if (error) throw error
      return data
    },
    enabled: !!user?.id,
  })
}

export function useQueryMutations() {
  const queryClient = useQueryClient()
  const { user } = useAuthStore()

  const createQuery = useMutation({
    mutationFn: async (newQuery: CreateQueryRequest) => {
      if (!user?.id) throw new Error('User not authenticated')
      
      const queryData = {
        ...newQuery,
        user_id: user.id,
        is_active: true
      }
      
      const { data, error } = await api.queries.create(queryData)
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queries'] })
    },
  })

  const updateQuery = useMutation({
    mutationFn: async ({ id, ...updates }: { id: number } & UpdateQueryRequest) => {
      const { data, error } = await api.queries.update(id, updates)
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queries'] })
    },
  })

  const deleteQuery = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await api.queries.delete(id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queries'] })
    },
  })

  return { createQuery, updateQuery, deleteQuery }
}

// lib/hooks/use-jobs.ts
// Frontend-only job management hooks
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/supabase-client'
import { useAuthStore } from '@/lib/stores/auth-store'
import { JobFilters } from '@/types/api'

export function useJobs(filters: JobFilters) {
  const { user } = useAuthStore()

  return useQuery({
    queryKey: ['jobs', user?.id, filters],
    queryFn: async () => {
      if (!user?.id) throw new Error('User not authenticated')
      
      const { data, error } = await api.jobs.list(user.id, filters)
      if (error) throw error
      return data
    },
    enabled: !!user?.id,
  })
}

// lib/hooks/use-subscription.ts
// Frontend-only subscription management
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/supabase-client'
import { useAuthStore } from '@/lib/stores/auth-store'

export function useSubscription() {
  const { user } = useAuthStore()

  const { data: userProfile, isLoading: profileLoading } = useQuery({
    queryKey: ['user-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error('User not authenticated')
      
      const { data, error } = await api.profiles.get(user.id)
      if (error) throw error
      return data
    },
    enabled: !!user?.id,
  })

  const { data: subscription, isLoading: subscriptionLoading } = useQuery({
    queryKey: ['subscription', user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error('User not authenticated')
      
      const { data, error } = await api.subscriptions.get(user.id)
      if (error && error.code !== 'PGRST116') throw error // Ignore "not found" errors
      return data
    },
    enabled: !!user?.id && userProfile?.account_type === 'user',
  })

  const hasAccess = (): boolean => {
    if (!userProfile) return false
    
    // Admin and privileged users always have access
    if (userProfile.account_type === 'admin' || userProfile.account_type === 'privileged') {
      return true
    }
    
    // Regular users need active subscription
    return subscription?.status === 'active'
  }

  const createCheckoutSession = async () => {
    const response = await fetch('/api/stripe/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user?.id,
        email: user?.email
      })
    })

    const { url } = await response.json()
    return url
  }

  const createPortalSession = async () => {
    const response = await fetch('/api/stripe/create-portal-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user?.id
      })
    })

    const { url } = await response.json()
    return url
  }

  return {
    subscription,
    userProfile,
    loading: profileLoading || subscriptionLoading,
    hasAccess: hasAccess(),
    createCheckoutSession,
    createPortalSession,
  }
}

// lib/hooks/use-cities.ts
// Frontend-only location data hooks
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/supabase-client'

export function useStates() {
  return useQuery({
    queryKey: ['us-states'],
    queryFn: async () => {
      const { data, error } = await api.cities.listStates()
      if (error) throw error
      
      // Extract unique state names
      const uniqueStates = [...new Set(data.map(item => item.state_name))].sort()
      return uniqueStates
    },
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
  })
}

export function useCitiesByState(stateName?: string) {
  return useQuery({
    queryKey: ['us-cities', stateName],
    queryFn: async () => {
      if (!stateName) return []
      
      const { data, error } = await api.cities.listCitiesByState(stateName)
      if (error) throw error
      return data
    },
    enabled: !!stateName,
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
  })
}

// lib/hooks/use-notifications.ts
// Frontend-only notification management
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/supabase-client'
import { useAuthStore } from '@/lib/stores/auth-store'

export function useNotificationPreferences() {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()

  const { data: preferences, isLoading } = useQuery({
    queryKey: ['notification-preferences', user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error('User not authenticated')
      
      const { data, error } = await api.notifications.getPreferences(user.id)
      if (error && error.code !== 'PGRST116') throw error // Ignore "not found" errors
      return data
    },
    enabled: !!user?.id,
  })

  const updatePreferences = useMutation({
    mutationFn: async (updates: any) => {
      if (!user?.id) throw new Error('User not authenticated')
      
      const { data, error } = await api.notifications.updatePreferences(user.id, {
        ...updates,
        updated_at: new Date().toISOString()
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] })
    },
  })

  return {
    preferences,
    isLoading,
    updatePreferences,
  }
}
```

### Frontend API Routes (Next.js API Routes)

```typescript
// app/api/stripe/create-checkout-session/route.ts
// Frontend API route - no shared backend code
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(req: NextRequest) {
  try {
    const { userId, email } = await req.json()
    
    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      customer_email: email,
      line_items: [{
        price: process.env.STRIPE_PRICE_ID,
        quantity: 1,
      }],
      mode: 'subscription',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing`,
      metadata: { user_id: userId }
    })

    return NextResponse.json({ url: session.url })
    
  } catch (error) {
    console.error('Stripe checkout error:', error)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}

// app/api/stripe/create-portal-session/route.ts
// Frontend API route for billing portal
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { api } from '@/lib/supabase-client'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json()
    
    // Get user's subscription to find Stripe customer ID
    const { data: subscription } = await api.subscriptions.get(userId)
    
    if (!subscription?.stripe_customer_id) {
      return NextResponse.json(
        { error: 'No subscription found' },
        { status: 404 }
      )
    }
    
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing`,
    })

    return NextResponse.json({ url: session.url })
    
  } catch (error) {
    console.error('Stripe portal error:', error)
    return NextResponse.json(
      { error: 'Failed to create portal session' },
      { status: 500 }
    )
  }
}

// app/api/stripe/webhook/route.ts
// Frontend webhook handler - communicates with backend via Supabase API
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { api } from '@/lib/supabase-client'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('stripe-signature')!

  try {
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdate(event.data.object as Stripe.Subscription)
        break
        
      case 'customer.subscription.deleted':
        await handleSubscriptionCancellation(event.data.object as Stripe.Subscription)
        break
    }

    return NextResponse.json({ received: true })
    
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 400 }
    )
  }
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  // Update subscription via Supabase API (no shared code)
  const updateData = {
    stripe_subscription_id: subscription.id,
    status: subscription.status as any,
    current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
    current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    cancel_at_period_end: subscription.cancel_at_period_end,
    updated_at: new Date().toISOString()
  }

  // Find user by Stripe customer ID and update subscription
  // This would require a custom API endpoint or direct Supabase call
  // Implementation depends on how you want to handle this without shared code
}
``` } = await supabase
        .from('queries')
        .insert(newQuery)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queries'] })
    },
  })

  const updateQuery = useMutation({
    mutationFn: async ({ id, ...updates }: { id: number } & Partial<Query>) => {
      const { data, error } = await supabase
        .from('queries')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queries'] })
    },
  })

  const deleteQuery = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase
        .from('queries')
        .delete()
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queries'] })
    },
  })

  return { createQuery, updateQuery, deleteQuery }
}

// lib/hooks/use-jobs.ts
export function useJobs(filters: JobFilters) {
  const { user } = useAuthStore()

  return useQuery({
    queryKey: ['jobs', user?.id, filters],
    queryFn: async () => {
      let query = supabase
        .from('jobs')
        .select(`
          *,
          queries(keywords)
        `)
        .eq('user_id', user?.id)

      // Apply filters
      if (filters.search) {
        query = query.or(`title.ilike.%${filters.search}%,company.ilike.%${filters.search}%`)
      }

      if (filters.queryId) {
        query = query.eq('query_id', filters.queryId)
      }

      if (filters.dateRange) {
        query = query
          .gte('posted', filters.dateRange.from.toISOString())
          .lte('posted', filters.dateRange.to.toISOString())
      }

      query = query.order(filters.sortBy, { ascending: filters.sortOrder === 'asc' })

      const { data, error } = await query
      if (error) throw error
      return data
    },
    enabled: !!user?.id,
  })
}
```

## Performance Optimization

### Code Splitting & Lazy Loading

```typescript
// app/(dashboard)/layout.tsx
import { Suspense } from 'react'
import dynamic from 'next/dynamic'

// Lazy load heavy components
const Sidebar = dynamic(() => import('@/components/layout/sidebar'), {
  loading: () => <SidebarSkeleton />
})

const Header = dynamic(() => import('@/components/layout/header'), {
  loading: () => <HeaderSkeleton />
})

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen bg-gray-50">
      <Suspense fallback={<SidebarSkeleton />}>
        <Sidebar />
      </Suspense>
      <div className="flex-1 flex flex-col overflow-hidden">
        <Suspense fallback={<HeaderSkeleton />}>
          <Header />
        </Suspense>
        <main className="flex-1 overflow-y-auto p-6">
          <Suspense fallback={<PageSkeleton />}>
            {children}
          </Suspense>
        </main>
      </div>
    </div>
  )
}
```

### Data Fetching Optimization

```typescript
// lib/hooks/use-dashboard-data.ts
export function useDashboardData() {
  // Parallel data fetching for dashboard
  const [
    { data: stats },
    { data: queries },
    { data: recentJobs },
    { data: systemHealth }
  ] = useQueries({
    queries: [
      {
        queryKey: ['dashboard-stats'],
        queryFn: fetchDashboardStats,
        staleTime: 5 * 60 * 1000, // 5 minutes
      },
      {
        queryKey: ['recent-queries'],
        queryFn: fetchRecentQueries,
        staleTime: 2 * 60 * 1000, // 2 minutes
      },
      {
        queryKey: ['recent-jobs'],
        queryFn: fetchRecentJobs,
        staleTime: 1 * 60 * 1000, // 1 minute
      },
      {
        queryKey: ['system-health'],
        queryFn: fetchSystemHealth,
        staleTime: 30 * 1000, // 30 seconds
        refetchInterval: 30 * 1000, // Auto-refresh every 30s
      }
    ]
  })

  return { stats, queries, recentJobs, systemHealth }
}
```

### Image Optimization

```typescript
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    turbo: {
      rules: {
        '*.svg': {
          loaders: ['@svgr/webpack'],
          as: '*.js',
        },
      },
    },
  },
  images: {
    domains: ['media.licdn.com', 'logo.clearbit.com'],
    formats: ['image/avif', 'image/webp'],
  },
  // Enable Turbopack for development
  ...(process.env.NODE_ENV === 'development' && {
    experimental: {
      turbo: {},
    },
  }),
}

module.exports = nextConfig
```

## Authorization & Access Control

### Page-Level Authorization Matrix

#### Account Type Definitions
- **Admin**: Full system access, user management, system monitoring
- **Privileged**: Free access to all job search features, no subscription required
- **User**: Basic access, subscription required for job search features

#### Page Access Control Specification

| Page/Route | Admin | Privileged | User (Active Sub) | User (No Sub) | Guest |
|------------|-------|------------|-------------------|---------------|-------|
| `/` (Landing) | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/login` | ❌* | ❌* | ❌* | ❌* | ✅ |
| `/signup` | ❌* | ❌* | ❌* | ❌* | ✅ |
| `/dashboard` | ✅ | ✅ | ✅ | 🔒** | ❌ |
| `/jobs` | ✅ | ✅ | ✅ | 🔒** | ❌ |
| `/jobs/[id]` | ✅ | ✅ | ✅ | 🔒** | ❌ |
| `/analytics` | ✅ | ✅ | ✅ | 🔒** | ❌ |
| `/settings` | ✅ | ✅ | ✅ | ✅ | ❌ |
| `/settings/notifications` | ✅ | ✅ | ✅ | ✅ | ❌ |
| `/settings/billing` | ✅ | ✅ | ✅ | ✅ | ❌ |
| `/admin` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `/admin/users` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `/admin/system` | ✅ | ❌ | ❌ | ❌ | ❌ |

**Legend:**
- ✅ Full Access
- 🔒** Limited Access (subscription upgrade prompt)
- ❌ No Access (redirect)
- ❌* Redirect to dashboard if authenticated

#### Feature-Level Access Control

```typescript
// lib/access-control.ts
export interface AccessControlConfig {
  pageAccess: PageAccessConfig
  featureAccess: FeatureAccessConfig
  subscriptionGates: SubscriptionGateConfig
}

interface PageAccessConfig {
  [route: string]: {
    admin: boolean
    privileged: boolean
    userWithSubscription: boolean
    userWithoutSubscription: boolean
    guest: boolean
    redirectTo?: string
    requiresSubscription?: boolean
  }
}

interface FeatureAccessConfig {
  createQuery: {
    admin: boolean
    privileged: boolean
    userWithSubscription: boolean
    userWithoutSubscription: boolean
  }
  viewJobs: {
    admin: boolean
    privileged: boolean
    userWithSubscription: boolean
    userWithoutSubscription: boolean
  }
  exportData: {
    admin: boolean
    privileged: boolean
    userWithSubscription: boolean
    userWithoutSubscription: boolean
  }
  analytics: {
    admin: boolean
    privileged: boolean
    userWithSubscription: boolean
    userWithoutSubscription: boolean
  }
  notifications: {
    admin: boolean
    privileged: boolean
    userWithSubscription: boolean
    userWithoutSubscription: boolean
  }
  userManagement: {
    admin: boolean
    privileged: boolean
    userWithSubscription: boolean
    userWithoutSubscription: boolean
  }
}

interface SubscriptionGateConfig {
  maxQueriesWithoutSubscription: number
  maxJobsWithoutSubscription: number
  gracePeriodDays: number
  trialFeatures: string[]
}

export const ACCESS_CONTROL_CONFIG: AccessControlConfig = {
  pageAccess: {
    '/': {
      admin: true,
      privileged: true,
      userWithSubscription: true,
      userWithoutSubscription: true,
      guest: true
    },
    '/login': {
      admin: false,
      privileged: false,
      userWithSubscription: false,
      userWithoutSubscription: false,
      guest: true,
      redirectTo: '/dashboard'
    },
    '/signup': {
      admin: false,
      privileged: false,
      userWithSubscription: false,
      userWithoutSubscription: false,
      guest: true,
      redirectTo: '/dashboard'
    },
    '/dashboard': {
      admin: true,
      privileged: true,
      userWithSubscription: true,
      userWithoutSubscription: false,
      guest: false,
      redirectTo: '/settings/billing',
      requiresSubscription: true
    },
    '/jobs': {
      admin: true,
      privileged: true,
      userWithSubscription: true,
      userWithoutSubscription: false,
      guest: false,
      redirectTo: '/settings/billing',
      requiresSubscription: true
    },
    '/analytics': {
      admin: true,
      privileged: true,
      userWithSubscription: true,
      userWithoutSubscription: false,
      guest: false,
      redirectTo: '/settings/billing',
      requiresSubscription: true
    },
    '/settings': {
      admin: true,
      privileged: true,
      userWithSubscription: true,
      userWithoutSubscription: true,
      guest: false,
      redirectTo: '/login'
    },
    '/settings/notifications': {
      admin: true,
      privileged: true,
      userWithSubscription: true,
      userWithoutSubscription: true,
      guest: false,
      redirectTo: '/login'
    },
    '/settings/billing': {
      admin: true,
      privileged: true,
      userWithSubscription: true,
      userWithoutSubscription: true,
      guest: false,
      redirectTo: '/login'
    },
    '/admin': {
      admin: true,
      privileged: false,
      userWithSubscription: false,
      userWithoutSubscription: false,
      guest: false,
      redirectTo: '/dashboard'
    },
    '/admin/users': {
      admin: true,
      privileged: false,
      userWithSubscription: false,
      userWithoutSubscription: false,
      guest: false,
      redirectTo: '/dashboard'
    },
    '/admin/system': {
      admin: true,
      privileged: false,
      userWithSubscription: false,
      userWithoutSubscription: false,
      guest: false,
      redirectTo: '/dashboard'
    }
  },
  featureAccess: {
    createQuery: {
      admin: true,
      privileged: true,
      userWithSubscription: true,
      userWithoutSubscription: false
    },
    viewJobs: {
      admin: true,
      privileged: true,
      userWithSubscription: true,
      userWithoutSubscription: false
    },
    exportData: {
      admin: true,
      privileged: true,
      userWithSubscription: true,
      userWithoutSubscription: false
    },
    analytics: {
      admin: true,
      privileged: true,
      userWithSubscription: true,
      userWithoutSubscription: false
    },
    notifications: {
      admin: true,
      privileged: true,
      userWithSubscription: true,
      userWithoutSubscription: true
    },
    userManagement: {
      admin: true,
      privileged: false,
      userWithSubscription: false,
      userWithoutSubscription: false
    }
  },
  subscriptionGates: {
    maxQueriesWithoutSubscription: 0,
    maxJobsWithoutSubscription: 0,
    gracePeriodDays: 7,
    trialFeatures: ['notifications', 'profile']
  }
}

// Authorization utility functions
export function hasPageAccess(
  route: string,
  accountType: string,
  hasActiveSubscription: boolean
): { hasAccess: boolean; redirectTo?: string } {
  const pageConfig = ACCESS_CONTROL_CONFIG.pageAccess[route]
  
  if (!pageConfig) {
    return { hasAccess: false, redirectTo: '/dashboard' }
  }

  let hasAccess = false

  switch (accountType) {
    case 'admin':
      hasAccess = pageConfig.admin
      break
    case 'privileged':
      hasAccess = pageConfig.privileged
      break
    case 'user':
      hasAccess = hasActiveSubscription 
        ? pageConfig.userWithSubscription 
        : pageConfig.userWithoutSubscription
      break
    default:
      hasAccess = pageConfig.guest
  }

  if (!hasAccess && pageConfig.redirectTo) {
    return { hasAccess: false, redirectTo: pageConfig.redirectTo }
  }

  return { hasAccess }
}

export function hasFeatureAccess(
  feature: keyof FeatureAccessConfig,
  accountType: string,
  hasActiveSubscription: boolean
): boolean {
  const featureConfig = ACCESS_CONTROL_CONFIG.featureAccess[feature]
  
  if (!featureConfig) {
    return false
  }

  switch (accountType) {
    case 'admin':
      return featureConfig.admin
    case 'privileged':
      return featureConfig.privileged
    case 'user':
      return hasActiveSubscription 
        ? featureConfig.userWithSubscription 
        : featureConfig.userWithoutSubscription
    default:
      return false
  }
}

export function getSubscriptionRequirement(
  accountType: string,
  feature?: string
): {
  requiresSubscription: boolean
  gracePeriodRemaining?: number
  trialAccess?: boolean
} {
  if (accountType === 'admin' || accountType === 'privileged') {
    return { requiresSubscription: false }
  }

  const config = ACCESS_CONTROL_CONFIG.subscriptionGates
  
  if (feature && config.trialFeatures.includes(feature)) {
    return { 
      requiresSubscription: false, 
      trialAccess: true 
    }
  }

  return { requiresSubscription: true }
}
```

### Page Guard Components

```typescript
// components/auth/page-guard.tsx
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/use-auth'
import { useSubscription } from '@/lib/hooks/use-subscription'
import { hasPageAccess } from '@/lib/access-control'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { SubscriptionGate } from '@/components/auth/subscription-gate'

interface PageGuardProps {
  children: React.ReactNode
  requiredAccess?: 'admin' | 'privileged' | 'user' | 'any'
  requiresSubscription?: boolean
  fallbackComponent?: React.ReactNode
}

export function PageGuard({ 
  children, 
  requiredAccess = 'any',
  requiresSubscription = false,
  fallbackComponent 
}: PageGuardProps) {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { subscription, userProfile, loading: subLoading } = useSubscription()

  useEffect(() => {
    if (authLoading || subLoading) return

    // Not authenticated
    if (!user) {
      router.push('/login')
      return
    }

    // Check account type access
    if (requiredAccess === 'admin' && userProfile?.account_type !== 'admin') {
      router.push('/dashboard')
      return
    }

    if (requiredAccess === 'privileged' && 
        !['admin', 'privileged'].includes(userProfile?.account_type || '')) {
      router.push('/dashboard')
      return
    }

    // Check subscription requirement for regular users
    if (requiresSubscription && 
        userProfile?.account_type === 'user' && 
        subscription?.status !== 'active') {
      // Will show subscription gate instead of redirecting
      return
    }

  }, [user, userProfile, subscription, authLoading, subLoading, router, requiredAccess, requiresSubscription])

  // Loading state
  if (authLoading || subLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    )
  }

  // Not authenticated
  if (!user) {
    return null // Will redirect in useEffect
  }

  // Access denied
  if (requiredAccess === 'admin' && userProfile?.account_type !== 'admin') {
    return fallbackComponent || null
  }

  if (requiredAccess === 'privileged' && 
      !['admin', 'privileged'].includes(userProfile?.account_type || '')) {
    return fallbackComponent || null
  }

  // Subscription gate for regular users
  if (requiresSubscription && 
      userProfile?.account_type === 'user' && 
      subscription?.status !== 'active') {
    return <SubscriptionGate />
  }

  // Access granted
  return <>{children}</>
}

// components/auth/subscription-gate.tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Lock, Star, Zap } from 'lucide-react'
import { useRouter } from 'next/navigation'

export function SubscriptionGate() {
  const router = useRouter()

  const features = [
    'Unlimited job search queries',
    'Real-time job discovery notifications',
    'Advanced analytics and insights',
    'Data export (CSV/JSON)',
    'Priority customer support'
  ]

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="h-8 w-8 text-blue-600" />
          </div>
          <CardTitle className="text-2xl font-bold">Subscription Required</CardTitle>
          <CardDescription>
            Upgrade to unlock powerful job search automation features
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            {features.map((feature, index) => (
              <div key={index} className="flex items-center space-x-3">
                <Zap className="h-4 w-4 text-green-500 flex-shrink-0" />
                <span className="text-sm text-gray-700">{feature}</span>
              </div>
            ))}
          </div>

          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-blue-900">Monthly Plan</span>
              <Badge className="bg-blue-600">
                <Star className="h-3 w-3 mr-1" />
                Popular
              </Badge>
            </div>
            <div className="text-3xl font-bold text-blue-900">$10<span className="text-lg font-normal">/month</span></div>
            <p className="text-sm text-blue-700 mt-1">Cancel anytime</p>
          </div>

          <div className="space-y-3">
            <Button 
              className="w-full" 
              onClick={() => router.push('/settings/billing')}
            >
              Upgrade Now
            </Button>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => router.push('/settings')}
            >
              Manage Account
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

### Route-Specific Guards

```typescript
// app/(dashboard)/dashboard/page.tsx
import { PageGuard } from '@/components/auth/page-guard'
import { DashboardContent } from '@/components/dashboard/dashboard-content'

export default function DashboardPage() {
  return (
    <PageGuard requiredAccess="user" requiresSubscription={true}>
      <DashboardContent />
    </PageGuard>
  )
}

// app/(dashboard)/jobs/page.tsx
import { PageGuard } from '@/components/auth/page-guard'
import { JobsContent } from '@/components/jobs/jobs-content'

export default function JobsPage() {
  return (
    <PageGuard requiredAccess="user" requiresSubscription={true}>
      <JobsContent />
    </PageGuard>
  )
}

// app/(dashboard)/analytics/page.tsx
import { PageGuard } from '@/components/auth/page-guard'
import { AnalyticsContent } from '@/components/analytics/analytics-content'

export default function AnalyticsPage() {
  return (
    <PageGuard requiredAccess="user" requiresSubscription={true}>
      <AnalyticsContent />
    </PageGuard>
  )
}

// app/(dashboard)/admin/page.tsx
import { PageGuard } from '@/components/auth/page-guard'
import { AdminDashboardContent } from '@/components/admin/admin-dashboard-content'

export default function AdminPage() {
  return (
    <PageGuard requiredAccess="admin">
      <AdminDashboardContent />
    </PageGuard>
  )
}

// app/(dashboard)/settings/page.tsx
import { PageGuard } from '@/components/auth/page-guard'
import { SettingsContent } from '@/components/settings/settings-content'

export default function SettingsPage() {
  return (
    <PageGuard requiredAccess="user">
      <SettingsContent />
    </PageGuard>
  )
}
```

### Feature-Level Guards

```typescript
// components/auth/feature-guard.tsx
import { useAuth } from '@/lib/hooks/use-auth'
import { useSubscription } from '@/lib/hooks/use-subscription'
import { hasFeatureAccess } from '@/lib/access-control'
import { Button } from '@/components/ui/button'
import { Lock } from 'lucide-react'

interface FeatureGuardProps {
  feature: string
  children: React.ReactNode
  fallback?: React.ReactNode
  showUpgradePrompt?: boolean
}

export function FeatureGuard({ 
  feature, 
  children, 
  fallback,
  showUpgradePrompt = true 
}: FeatureGuardProps) {
  const { user } = useAuth()
  const { subscription, userProfile } = useSubscription()

  if (!user || !userProfile) {
    return null
  }

  const hasAccess = hasFeatureAccess(
    feature as any,
    userProfile.account_type,
    subscription?.status === 'active'
  )

  if (hasAccess) {
    return <>{children}</>
  }

  if (fallback) {
    return <>{fallback}</>
  }

  if (showUpgradePrompt && userProfile.account_type === 'user') {
    return (
      <div className="flex items-center justify-center p-4 border border-gray-200 rounded-lg bg-gray-50">
        <div className="text-center space-y-3">
          <Lock className="h-8 w-8 text-gray-400 mx-auto" />
          <div>
            <p className="text-sm font-medium text-gray-900">Premium Feature</p>
            <p className="text-xs text-gray-600">Upgrade to access this feature</p>
          </div>
          <Button size="sm" onClick={() => window.location.href = '/settings/billing'}>
            Upgrade
          </Button>
        </div>
      </div>
    )
  }

  return null
}

// Usage in components
export function CreateQueryButton() {
  return (
    <FeatureGuard feature="createQuery">
      <Button onClick={handleCreateQuery}>
        <Plus className="h-4 w-4 mr-2" />
        New Query
      </Button>
    </FeatureGuard>
  )
}

export function ExportButton({ jobs }: { jobs: Job[] }) {
  return (
    <FeatureGuard feature="exportData">
      <JobExportButton jobs={jobs} />
    </FeatureGuard>
  )
}
```

### Navigation Guards

```typescript
// components/layout/protected-nav-item.tsx
import { ReactNode } from 'react'
import { useAuth } from '@/lib/hooks/use-auth'
import { useSubscription } from '@/lib/hooks/use-subscription'
import { hasPageAccess } from '@/lib/access-control'

interface ProtectedNavItemProps {
  href: string
  children: ReactNode
  className?: string
}

export function ProtectedNavItem({ href, children, className }: ProtectedNavItemProps) {
  const { user } = useAuth()
  const { subscription, userProfile } = useSubscription()

  if (!user || !userProfile) {
    return null
  }

  const { hasAccess } = hasPageAccess(
    href,
    userProfile.account_type,
    subscription?.status === 'active'
  )

  if (!hasAccess) {
    return null
  }

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  )
}

// Updated sidebar component
function SidebarItem({ item, collapsed, pathname }: SidebarItemProps) {
  return (
    <ProtectedNavItem
      href={item.href}
      className={cn(
        "flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
        pathname === item.href 
          ? "bg-blue-600 text-white" 
          : "text-gray-300 hover:bg-gray-800 hover:text-white",
        collapsed && "justify-center"
      )}
    >
      <item.icon className="h-5 w-5 flex-shrink-0" />
      {!collapsed && (
        <>
          <span className="flex-1">{item.label}</span>
          {item.badge && (
            <Badge variant="secondary" className="ml-auto">
              {item.badge}
            </Badge>
          )}
        </>
      )}
    </ProtectedNavItem>
  )
}
```

## Security Implementation

### Authentication Middleware

```typescript
// middleware.ts
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  const {
    data: { session },
  } = await supabase.auth.getSession()

  // Protect dashboard routes
  if (req.nextUrl.pathname.startsWith('/dashboard') || 
      req.nextUrl.pathname.startsWith('/jobs') ||
      req.nextUrl.pathname.startsWith('/analytics') ||
      req.nextUrl.pathname.startsWith('/settings')) {
    if (!session) {
      return NextResponse.redirect(new URL('/login', req.url))
    }
  }

  // Protect admin routes
  if (req.nextUrl.pathname.startsWith('/admin')) {
    if (!session) {
      return NextResponse.redirect(new URL('/login', req.url))
    }

    // Check if user has admin access
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('account_type')
      .eq('id', session.user.id)
      .single()

    if (profile?.account_type !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
  }

  // Redirect authenticated users away from auth pages
  if (req.nextUrl.pathname.startsWith('/login') && session) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  return res
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/jobs/:path*',
    '/analytics/:path*',
    '/settings/:path*',
    '/admin/:path*',
    '/login'
  ]
}
```

### Input Validation

```typescript
// lib/validations.ts
import { z } from 'zod'

export const createQuerySchema = z.object({
  keywords: z
    .string()
    .min(1, 'Keywords are required')
    .max(100, 'Keywords must be less than 100 characters')
    .regex(/^[a-zA-Z0-9\s\-_,]+$/, 'Keywords contain invalid characters'),
  work_types: z
    .array(z.number().int().min(1).max(3))
    .min(1, 'At least one work type must be selected')
    .max(3, 'Maximum 3 work types allowed'),
  city_id: z.number().int().positive().optional(),
  location_string: z.string().max(200).optional()
})

export const updateProfileSchema = z.object({
  full_name: z
    .string()
    .min(1, 'Name is required')
    .max(50, 'Name must be less than 50 characters')
    .regex(/^[a-zA-Z\s]+$/, 'Name can only contain letters and spaces'),
  company: z
    .string()
    .max(100, 'Company name must be less than 100 characters')
    .optional()
})

export const notificationSettingsSchema = z.object({
  email_notifications: z.boolean(),
  push_notifications: z.boolean(),
  webhook_notifications: z.boolean(),
  webhook_url: z
    .string()
    .url('Must be a valid URL')
    .optional()
    .or(z.literal('')),
  notification_frequency: z.enum(['immediate', 'hourly', 'daily'])
})
```

## Testing Strategy

### Unit Tests

```typescript
// __tests__/components/job-card.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { JobCard } from '@/components/jobs/job-card'

const mockJob = {
  id: 1,
  title: 'Software Engineer',
  company: 'Tech Corp',
  location: 'San Francisco, CA',
  link: 'https://linkedin.com/jobs/123',
  posted: '2024-01-15T10:00:00Z',
  query: {
    keywords: 'software engineer'
  }
}

describe('JobCard', () => {
  it('renders job information correctly', () => {
    render(<JobCard job={mockJob} />)
    
    expect(screen.getByText('Software Engineer')).toBeInTheDocument()
    expect(screen.getByText('Tech Corp')).toBeInTheDocument()
    expect(screen.getByText('San Francisco, CA')).toBeInTheDocument()
  })

  it('opens job link in new tab when clicked', () => {
    const mockOpen = jest.fn()
    global.open = mockOpen

    render(<JobCard job={mockJob} />)
    
    fireEvent.click(screen.getByText('View'))
    
    expect(mockOpen).toHaveBeenCalledWith(
      mockJob.link,
      '_blank',
      'noopener,noreferrer'
    )
  })

  it('calls onMarkAsApplied when button is clicked', () => {
    const onMarkAsApplied = jest.fn()
    
    render(<JobCard job={mockJob} onMarkAsApplied={onMarkAsApplied} />)
    
    fireEvent.click(screen.getByText('Mark Applied'))
    
    expect(onMarkAsApplied).toHaveBeenCalledWith(mockJob.id)
  })
})
```

### Integration Tests

```typescript
// __tests__/pages/dashboard.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import DashboardPage from '@/app/(dashboard)/dashboard/page'

// Mock the Supabase client
jest.mock('@/lib/supabase')

const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  )
}

describe('Dashboard Page', () => {
  it('displays dashboard stats correctly', async () => {
    renderWithProviders(<DashboardPage />)
    
    await waitFor(() => {
      expect(screen.getByText('Active Queries')).toBeInTheDocument()
      expect(screen.getByText('Jobs Found Today')).toBeInTheDocument()
      expect(screen.getByText('Success Rate')).toBeInTheDocument()
    })
  })

  it('shows empty state when no queries exist', async () => {
    renderWithProviders(<DashboardPage />)
    
    await waitFor(() => {
      expect(screen.getByText('No job queries configured yet')).toBeInTheDocument()
    })
  })
})
```

## Deployment Configuration

### Vercel Configuration

```json
// vercel.json
{
  "framework": "nextjs",
  "buildCommand": "next build",
  "devCommand": "next dev --turbo",
  "installCommand": "npm install",
  "functions": {
    "app/api/**": {
      "maxDuration": 30
    }
  },
  "env": {
    "NEXT_PUBLIC_SUPABASE_URL": "@supabase-url",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY": "@supabase-anon-key",
    "SUPABASE_SERVICE_ROLE_KEY": "@supabase-service-role-key"
  },
  "build": {
    "env": {
      "NEXT_TELEMETRY_DISABLED": "1"
    }
  },
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        }
      ]
    }
  ]
}
```

### Package.json Scripts

```json
{
  "name": "linkedin-job-scraper-frontend",
  "version": "1.0.0",
  "scripts": {
    "dev": "next dev --turbo",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "lint:fix": "next lint --fix",
    "type-check": "tsc --noEmit",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "analyze": "ANALYZE=true next build"
  },
  "dependencies": {
    "next": "^14.0.0",
    "@supabase/auth-helpers-nextjs": "^0.8.0",
    "@supabase/supabase-js": "^2.39.0",
    "@tanstack/react-query": "^5.0.0",
    "zustand": "^4.4.0",
    "react-hook-form": "^7.48.0",
    "zod": "^3.22.0",
    "@hookform/resolvers": "^3.3.0",
    "tailwindcss": "^3.3.0",
    "lucide-react": "^0.294.0",
    "date-fns": "^2.30.0",
    "recharts": "^2.8.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.0.0",
    "tailwind-merge": "^2.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^18.0.0",
    "@types/react-dom": "^18.0.0",
    "typescript": "^5.0.0",
    "eslint": "^8.0.0",
    "eslint-config-next": "^14.0.0",
    "@testing-library/react": "^14.0.0",
    "@testing-library/jest-dom": "^6.0.0",
    "jest": "^29.0.0",
    "jest-environment-jsdom": "^29.0.0"
  }
}
```

## Monitoring & Analytics

### Error Tracking

```typescript
// lib/error-tracking.ts
import * as Sentry from '@sentry/nextjs'

export function initErrorTracking() {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    beforeSend(event) {
      // Filter out development errors
      if (process.env.NODE_ENV === 'development') {
        return null
      }
      return event
    }
  })
}

export function trackError(error: Error, context?: Record<string, any>) {
  Sentry.captureException(error, {
    tags: {
      component: context?.component,
      action: context?.action
    },
    extra: context
  })
}

export function trackEvent(eventName: string, properties?: Record<string, any>) {
  // Analytics tracking
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', eventName, properties)
  }
}
```

### Performance Monitoring

```typescript
// lib/performance.ts
export function measurePageLoad(pageName: string) {
  if (typeof window !== 'undefined') {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'navigation') {
          const navigationEntry = entry as PerformanceNavigationTiming
          
          trackEvent('page_load_time', {
            page: pageName,
            loadTime: navigationEntry.loadEventEnd - navigationEntry.loadEventStart,
            domContentLoaded: navigationEntry.domContentLoadedEventEnd - navigationEntry.domContentLoadedEventStart,
            firstContentfulPaint: navigationEntry.responseEnd - navigationEntry.responseStart
          })
        }
      }
    })
    
    observer.observe({ entryTypes: ['navigation'] })
  }
}

export function measureComponentRender(componentName: string) {
  const startTime = performance.now()
  
  return () => {
    const endTime = performance.now()
    const renderTime = endTime - startTime
    
    if (renderTime > 100) { // Only track slow renders
      trackEvent('slow_component_render', {
        component: componentName,
        renderTime,
        threshold: 100
      })
    }
  }
}
```

## Accessibility Implementation

### ARIA Labels and Screen Reader Support

```typescript
// components/ui/accessible-table.tsx
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

interface AccessibleTableProps {
  caption: string
  headers: string[]
  data: any[]
  ariaLabel?: string
}

export function AccessibleTable({ caption, headers, data, ariaLabel }: AccessibleTableProps) {
  return (
    <div className="overflow-x-auto">
      <Table aria-label={ariaLabel || caption}>
        <caption className="sr-only">{caption}</caption>
        <TableHeader>
          <TableRow>
            {headers.map((header, index) => (
              <TableHead 
                key={index}
                scope="col"
                className="text-left font-medium"
              >
                {header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, rowIndex) => (
            <TableRow key={rowIndex}>
              {Object.values(row).map((cell: any, cellIndex) => (
                <TableCell 
                  key={cellIndex}
                  className="text-left"
                >
                  {cell}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

// components/ui/skip-navigation.tsx
export function SkipNavigation() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-blue-600 text-white px-4 py-2 rounded-md z-50"
    >
      Skip to main content
    </a>
  )
}
```

### Keyboard Navigation

```typescript
// components/layout/keyboard-navigation.tsx
import { useEffect } from 'react'

export function useKeyboardNavigation() {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl/Cmd + K for global search
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault()
        // Open search dialog
        document.getElementById('global-search')?.focus()
      }

      // Escape to close modals
      if (event.key === 'Escape') {
        // Close any open modals or dialogs
        document.querySelector('[data-modal-open]')?.click()
      }

      // Arrow keys for navigation
      if (event.altKey) {
        switch (event.key) {
          case 'ArrowLeft':
            // Navigate back
            window.history.back()
            break
          case 'ArrowRight':
            // Navigate forward
            window.history.forward()
            break
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])
}
```

## Responsive Design

### Mobile-First Breakpoints

```css
/* styles/responsive.css */
@layer utilities {
  /* Mobile-first responsive utilities */
  .container-responsive {
    @apply w-full mx-auto px-4;
    @apply sm:px-6;
    @apply lg:px-8;
    @apply xl:max-w-7xl;
  }

  .grid-responsive {
    @apply grid grid-cols-1;
    @apply sm:grid-cols-2;
    @apply lg:grid-cols-3;
    @apply xl:grid-cols-4;
  }

  .text-responsive {
    @apply text-sm;
    @apply sm:text-base;
    @apply lg:text-lg;
  }

  /* Dashboard specific responsive classes */
  .dashboard-grid {
    @apply grid grid-cols-1 gap-4;
    @apply md:grid-cols-2 md:gap-6;
    @apply lg:grid-cols-3;
    @apply xl:grid-cols-4;
  }

  .sidebar-responsive {
    @apply w-full h-auto border-b;
    @apply lg:w-64 lg:h-screen lg:border-r lg:border-b-0;
  }
}
```

### Mobile Navigation

```typescript
// components/layout/mobile-navigation.tsx
import { useState } from 'react'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Menu } from 'lucide-react'

export function MobileNavigation() {
  const [open, setOpen] = useState(false)

  return (
    <div className="lg:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="sm">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Open navigation menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <div className="flex flex-col h-full bg-gray-900 text-white">
            {/* Mobile navigation content */}
            <div className="p-4 border-b border-gray-800">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold">JS</span>
                </div>
                <span className="font-semibold">Job Scraper</span>
              </div>
            </div>
            
            <nav className="flex-1 p-4">
              {SIDEBAR_CONFIG.map((item) => (
                <MobileSidebarItem
                  key={item.id}
                  item={item}
                  onNavigate={() => setOpen(false)}
                />
              ))}
            </nav>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
```

## Advanced Features

### Real-time Updates

```typescript
// lib/hooks/use-realtime.ts
import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function useRealtimeSubscription(table: string, queryKey: string[]) {
  const queryClient = useQueryClient()

  useEffect(() => {
    const subscription = supabase
      .channel(`realtime:${table}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: table,
        },
        (payload) => {
          console.log('Real-time update:', payload)
          
          // Invalidate and refetch queries
          queryClient.invalidateQueries({ queryKey })
          
          // Optionally show toast notification
          if (payload.eventType === 'INSERT' && table === 'jobs') {
            // Show "New job found" notification
            toast.success('New job discovered!')
          }
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [table, queryKey, queryClient])
}

// Usage in components
export function useJobUpdates() {
  useRealtimeSubscription('jobs', ['jobs'])
}
```

### Dark Mode Implementation

```typescript
// lib/hooks/use-theme.ts
import { useEffect } from 'react'
import { useUIStore } from '@/lib/stores/ui-store'

export function useTheme() {
  const { theme, setTheme } = useUIStore()

  useEffect(() => {
    const root = window.document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light')
  }

  return { theme, setTheme, toggleTheme }
}

// components/ui/theme-toggle.tsx
import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/lib/hooks/use-theme'

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      {theme === 'light' ? (
        <Moon className="h-4 w-4" />
      ) : (
        <Sun className="h-4 w-4" />
      )}
    </Button>
  )
}
```

### Data Export Functionality

```typescript
// lib/utils/export.ts
import { format } from 'date-fns'

export function exportToCSV(data: any[], filename: string) {
  const headers = Object.keys(data[0])
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header]
        // Escape quotes and wrap in quotes if contains comma
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`
        }
        return value
      }).join(',')
    )
  ].join('\n')

  downloadFile(csvContent, `${filename}.csv`, 'text/csv')
}

export function exportToJSON(data: any[], filename: string) {
  const jsonContent = JSON.stringify(data, null, 2)
  downloadFile(jsonContent, `${filename}.json`, 'application/json')
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  
  URL.revokeObjectURL(url)
}

// components/jobs/job-export.tsx
export function JobExportButton({ jobs }: { jobs: Job[] }) {
  const handleExport = (format: 'csv' | 'json') => {
    const exportData = jobs.map(job => ({
      title: job.title,
      company: job.company,
      location: job.location,
      posted: format(new Date(job.posted), 'yyyy-MM-dd'),
      link: job.link,
      keywords: job.query?.keywords || ''
    }))

    const timestamp = format(new Date(), 'yyyy-MM-dd-HHmm')
    const filename = `job-discoveries-${timestamp}`

    if (format === 'csv') {
      exportToCSV(exportData, filename)
    } else {
      exportToJSON(exportData, filename)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={() => handleExport('csv')}>
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('json')}>
          Export as JSON
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

## Backend Data Types

### Frontend-Defined Database Schema Types
*Note: These types are defined independently in the frontend using Supabase SDK patterns*

```typescript
// types/database.ts
// Frontend types that mirror backend schema via Supabase SDK
// Uses Supabase generated types pattern

export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string
          account_type: 'admin' | 'privileged' | 'user'
          full_name: string | null
          company: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          account_type?: 'admin' | 'privileged' | 'user'
          full_name?: string | null
          company?: string | null
        }
        Update: {
          account_type?: 'admin' | 'privileged' | 'user'
          full_name?: string | null
          company?: string | null
          updated_at?: string
        }
      }
      subscriptions: {
        Row: {
          id: number
          user_id: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          status: 'active' | 'inactive' | 'canceled' | 'past_due'
          plan_id: string
          current_period_start: string | null
          current_period_end: string | null
          cancel_at_period_end: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          status?: 'active' | 'inactive' | 'canceled' | 'past_due'
          plan_id?: string
          current_period_start?: string | null
          current_period_end?: string | null
          cancel_at_period_end?: boolean
        }
        Update: {
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          status?: 'active' | 'inactive' | 'canceled' | 'past_due'
          plan_id?: string
          current_period_start?: string | null
          current_period_end?: string | null
          cancel_at_period_end?: boolean
          updated_at?: string
        }
      }
      us_cities: {
        Row: {
          id: number
          city: string
          state_id: string
          state_name: string
          linkedin_id: number | null
          created_at: string
        }
        Insert: {
          city: string
          state_id: string
          state_name: string
          linkedin_id?: number | null
        }
        Update: {
          city?: string
          state_id?: string
          state_name?: string
          linkedin_id?: number | null
        }
      }
      queries: {
        Row: {
          id: number
          user_id: string
          keywords: string
          work_types: number[]
          city_id: number | null
          location_string: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          keywords: string
          work_types: number[]
          city_id?: number | null
          location_string?: string | null
          is_active?: boolean
        }
        Update: {
          keywords?: string
          work_types?: number[]
          city_id?: number | null
          location_string?: string | null
          is_active?: boolean
          updated_at?: string
        }
      }
      jobs: {
        Row: {
          id: number
          query_id: number
          user_id: string
          title: string
          company: string
          link: string
          location: string
          posted: string
          created_at: string
        }
        Insert: {
          query_id: number
          user_id: string
          title: string
          company: string
          link: string
          location: string
          posted: string
        }
        Update: {
          title?: string
          company?: string
          location?: string
          posted?: string
        }
      }
      notification_preferences: {
        Row: {
          id: number
          user_id: string
          email_notifications: boolean
          push_notifications: boolean
          webhook_notifications: boolean
          webhook_url: string | null
          webhook_secret: string | null
          notification_frequency: 'immediate' | 'hourly' | 'daily'
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          email_notifications?: boolean
          push_notifications?: boolean
          webhook_notifications?: boolean
          webhook_url?: string | null
          webhook_secret?: string | null
          notification_frequency?: 'immediate' | 'hourly' | 'daily'
        }
        Update: {
          email_notifications?: boolean
          push_notifications?: boolean
          webhook_notifications?: boolean
          webhook_url?: string | null
          webhook_secret?: string | null
          notification_frequency?: 'immediate' | 'hourly' | 'daily'
          updated_at?: string
        }
      }
    }
  }
}

// Frontend convenience types
export type UserProfile = Database['public']['Tables']['user_profiles']['Row']
export type Subscription = Database['public']['Tables']['subscriptions']['Row']
export type USCity = Database['public']['Tables']['us_cities']['Row']
export type Query = Database['public']['Tables']['queries']['Row']
export type Job = Database['public']['Tables']['jobs']['Row']
export type NotificationPreferences = Database['public']['Tables']['notification_preferences']['Row']
```

### Supabase SDK Client Configuration

```typescript
// lib/supabase.ts
// Standard Supabase SDK setup - no shared code with Edge Functions
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { Database } from '@/types/database'

// Client-side Supabase client
export const createClient = () => 
  createClientComponentClient<Database>()

// Server-side Supabase client
export const createServerClient = () => 
  createServerComponentClient<Database>({ cookies })

// Default client for client components
export const supabase = createClient()
```

### API Request/Response Types

```typescript
// types/api.ts
export interface CreateQueryRequest {
  keywords: string
  work_types: number[]
  city_id?: number
  location_string?: string
}

export interface UpdateQueryRequest {
  keywords?: string
  work_types?: number[]
  city_id?: number
  location_string?: string
  is_active?: boolean
}

export interface JobFilters {
  search?: string
  queryId?: number
  dateRange?: { from: Date; to: Date }
  sortBy: 'posted' | 'company' | 'title'
  sortOrder: 'asc' | 'desc'
}

export interface DashboardStats {
  activeQueries: number
  jobsFoundToday: number
  totalJobs: number
  successRate: number
  lastProcessingTime?: string
}

export interface SystemHealthStatus {
  jobProcessor: 'operational' | 'degraded' | 'down'
  database: 'operational' | 'degraded' | 'down'
  notifications: 'operational' | 'degraded' | 'down'
  scraper: 'operational' | 'degraded' | 'down'
}
```

## Production Checklist

### Performance Optimization
- [ ] Implement code splitting for large components
- [ ] Optimize images with Next.js Image component
- [ ] Use React.memo for expensive components
- [ ] Implement virtual scrolling for large lists
- [ ] Enable Turbopack for faster development builds
- [ ] Configure bundle analyzer for production builds

### Security
- [ ] Implement CSP headers
- [ ] Add CSRF protection
- [ ] Validate all user inputs with Zod
- [ ] Implement rate limiting for API routes
- [ ] Add authentication middleware
- [ ] Secure cookie settings

### SEO & Accessibility
- [ ] Add meta tags for all pages
- [ ] Implement proper heading hierarchy
- [ ] Add alt text for all images
- [ ] Ensure proper color contrast ratios
- [ ] Test with screen readers
- [ ] Implement skip navigation links

### Monitoring & Analytics
- [ ] Set up Sentry error tracking
- [ ] Implement Vercel Analytics
- [ ] Add performance monitoring
- [ ] Set up health check endpoints
- [ ] Implement logging for user actions

### Testing
- [ ] Unit tests for all components
- [ ] Integration tests for critical user flows
- [ ] E2E tests with Playwright
- [ ] Performance testing with Lighthouse
- [ ] Accessibility testing with axe

### Deployment
- [ ] Configure environment variables
- [ ] Set up staging environment
- [ ] Implement CI/CD pipeline
- [ ] Configure domain and SSL
- [ ] Set up monitoring alerts

### Development Workflow
- [ ] Configure ESLint and Prettier
- [ ] Set up pre-commit hooks
- [ ] Configure TypeScript strict mode
- [ ] Set up automated testing
- [ ] Configure Turbo for monorepo builds

## Architecture Benefits

### Modern Stack Advantages
- **Next.js 14 + Turbo**: Fastest possible development and production builds
- **Vercel Deployment**: Zero-config deployment with edge network optimization
- **Supabase Integration**: Real-time updates and serverless database
- **TypeScript**: Full type safety across the entire application
- **shadcn/ui**: Consistent, accessible component library

### Scalability Features
- **Component-based Architecture**: Reusable, maintainable code
- **Zustand State Management**: Lightweight, performant global state
- **TanStack Query**: Intelligent data caching and synchronization
- **Responsive Design**: Works perfectly on all device sizes
- **Progressive Enhancement**: Core functionality works without JavaScript

### Developer Experience
- **Hot Reloading**: Instant feedback during development
- **Type Safety**: Catch errors at compile time
- **Automated Testing**: Comprehensive test coverage
- **Code Splitting**: Optimal bundle sizes
- **Error Monitoring**: Real-time error tracking and alerting

This comprehensive frontend engineering requirements document provides a complete roadmap for building a professional, scalable LinkedIn Job Scraper dashboard with modern web technologies and industry best practices.
              