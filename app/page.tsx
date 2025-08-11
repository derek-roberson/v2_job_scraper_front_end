'use client'

import { useAuth } from '@/utils/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export default function LandingPage() {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  if (isAuthenticated) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="container mx-auto px-4 py-6">
        <nav className="flex justify-between items-center">
          <div className="text-2xl font-bold text-gray-900">
            Job Alerts
          </div>
          <div className="space-x-4">
            <Link href="/login">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link href="/login">
              <Button>Get Started</Button>
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-4 py-16">
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Automate Your Job Search with{' '}
            <span className="text-blue-600">Professional Intelligence</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Professional job search automation with real-time LinkedIn scraping, 
            intelligent notifications, and comprehensive analytics. Never miss the 
            perfect opportunity again.
          </p>
          <div className="space-x-4">
            <Link href="/login">
              <Button size="lg" className="px-8 py-3">
                Start Free Trial
              </Button>
            </Link>
            <Button variant="outline" size="lg" className="px-8 py-3">
              Watch Demo
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 mt-20">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Real-time Job Scraping</CardTitle>
              <CardDescription>
                Automated LinkedIn job discovery with intelligent filtering
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Set up custom search queries and let our system continuously 
                monitor for new opportunities that match your criteria.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Smart Notifications</CardTitle>
              <CardDescription>
                Get instant alerts for the jobs that matter most
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Receive real-time notifications via email, SMS, or in-app alerts 
                when new jobs match your specific requirements.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Analytics Dashboard</CardTitle>
              <CardDescription>
                Track your job search performance with detailed insights
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Monitor search trends, success rates, and optimize your job search 
                strategy with comprehensive analytics.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* CTA Section */}
        <div className="text-center mt-20">
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="text-3xl">Ready to Transform Your Job Search?</CardTitle>
              <CardDescription className="text-lg">
                Join thousands of professionals who have automated their way to success.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/login">
                <Button size="lg" className="w-full">
                  Get Started Now - Free Trial
                </Button>
              </Link>
              <p className="text-sm text-gray-500 mt-4">
                No credit card required • 14-day free trial • Cancel anytime
              </p>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <div className="text-2xl font-bold mb-4">Job Alerts</div>
            <p className="text-gray-400">
              Professional job search automation platform
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
