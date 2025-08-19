'use client'

import { useAuth } from '@/utils/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Clock, Mail, Target, Zap, CheckCircle, Users } from 'lucide-react'

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
          <div className="flex items-center space-x-2">
            <div className="text-xl sm:text-2xl font-bold text-gray-900">
              JobFirst
            </div>
            <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-xs sm:text-sm">
              Beta
            </Badge>
          </div>
          <div className="flex gap-2 sm:gap-4">
            <Link href="/login">
              <Button variant="ghost" className="bg-white/70 hover:bg-white border border-gray-200 text-gray-700 hover:text-gray-900 text-sm sm:text-base px-3 sm:px-4">
                <span className="hidden sm:inline">Sign In</span>
                <span className="sm:hidden">Login</span>
              </Button>
            </Link>
            <Link href="/login?mode=signup">
              <Button className="text-sm sm:text-base px-3 sm:px-4">
                <span className="hidden sm:inline">Get Started Free</span>
                <span className="sm:hidden">Start Free</span>
              </Button>
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-4 py-16">
        <div className="text-center max-w-4xl mx-auto">
          <div className="flex justify-center mb-6">
            <Badge className="bg-green-100 text-green-800 border-green-200 px-4 py-2 text-sm font-medium">
              <Zap className="w-4 h-4 mr-2" />
              Be Among the First 20 Applicants
            </Badge>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
            Get LinkedIn Job Alerts{' '}
            <span className="text-blue-600">Before Everyone Else</span>
          </h1>
          <p className="text-lg sm:text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Set up custom job search queries and get hourly email alerts for new LinkedIn postings. 
            Apply early, stand out from the crowd, and land your dream job faster.
          </p>
          
          {/* Social Proof */}
          <div className="flex flex-col sm:flex-row justify-center items-center gap-3 sm:gap-6 mb-8 text-xs sm:text-sm text-gray-600">
            <div className="flex items-center">
              <Users className="w-4 h-4 mr-1" />
              <span>2,000+ active job seekers</span>
            </div>
            <div className="flex items-center">
              <CheckCircle className="w-4 h-4 mr-1 text-green-600" />
              <span>Average 3 min faster applications</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
            <Link href="/login?mode=signup">
              <Button size="lg" className="w-full sm:w-auto px-6 sm:px-8 py-3">
                Start Getting Alerts Free
              </Button>
            </Link>
            <Button variant="outline" size="lg" className="w-full sm:w-auto px-6 sm:px-8 py-3">
              See How It Works
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 mt-12 sm:mt-20">
          <Card className="border-2 hover:border-blue-200 transition-colors">
            <CardHeader>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <Clock className="w-6 h-6 text-blue-600" />
              </div>
              <CardTitle className="text-xl">Hourly Job Alerts</CardTitle>
              <CardDescription>
                Get notified the moment new jobs are posted
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Receive consolidated email alerts every hour with all new LinkedIn jobs 
                matching your search criteria. No spam - just the latest opportunities.
              </p>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-blue-200 transition-colors">
            <CardHeader>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <Target className="w-6 h-6 text-green-600" />
              </div>
              <CardTitle className="text-xl">Custom Search Queries</CardTitle>
              <CardDescription>
                Personalized job search tailored to your needs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Create multiple search queries with specific keywords, locations, and 
                job types. Monitor different career paths simultaneously.
              </p>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-blue-200 transition-colors">
            <CardHeader>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <Mail className="w-6 h-6 text-purple-600" />
              </div>
              <CardTitle className="text-xl">Smart Scheduling</CardTitle>
              <CardDescription>
                Control when and how often you get alerts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Choose hourly alerts or customize specific hours when you want to receive 
                notifications. Perfect for maintaining work-life balance.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* How It Works Section */}
        <div className="mt-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">How It Works</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Start getting early access to new job postings in just 3 simple steps
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mb-4 mx-auto">
                1
              </div>
              <h3 className="text-xl font-semibold mb-2">Create Your Search</h3>
              <p className="text-gray-600">
                Sign up and define your job search criteria with keywords, locations, and preferences.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mb-4 mx-auto">
                2
              </div>
              <h3 className="text-xl font-semibold mb-2">Get Hourly Alerts</h3>
              <p className="text-gray-600">
                Receive email notifications with new job postings that match your criteria every hour.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mb-4 mx-auto">
                3
              </div>
              <h3 className="text-xl font-semibold mb-2">Apply First</h3>
              <p className="text-gray-600">
                Click through to LinkedIn and be among the first 20 applicants for competitive positions.
              </p>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center mt-20">
          <Card className="max-w-2xl mx-auto bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
            <CardHeader>
              <CardTitle className="text-3xl">Start Getting Early Job Alerts Today</CardTitle>
              <CardDescription className="text-lg">
                Join job seekers who are landing interviews faster with early application advantages.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/login?mode=signup">
                <Button size="lg" className="w-full bg-blue-600 hover:bg-blue-700">
                  Create Your First Job Alert - Free
                </Button>
              </Link>
              <p className="text-sm text-gray-500 mt-4">
                Free forever • No credit card required • Setup in under 2 minutes
              </p>
              
              {/* Additional trust indicators */}
              <div className="flex justify-center items-center space-x-6 mt-6 text-sm text-gray-600">
                <div className="flex items-center">
                  <CheckCircle className="w-4 h-4 mr-1 text-green-600" />
                  <span>Email verified accounts only</span>
                </div>
                <div className="flex items-center">
                  <CheckCircle className="w-4 h-4 mr-1 text-green-600" />
                  <span>No spam guarantee</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <div className="text-2xl font-bold mb-4">JobFirst</div>
            <p className="text-gray-400 mb-6">
              Get early access to LinkedIn job postings with smart hourly alerts
            </p>
            <div className="flex justify-center space-x-8 text-sm text-gray-400">
              <span>Early application advantage</span>
              <span>•</span>
              <span>Custom notification scheduling</span>
              <span>•</span>
              <span>No spam guarantee</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
