'use client'

import { useState } from 'react'
import { useAuth } from '@/utils/hooks/use-auth'
import { supabase } from '@/utils/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function TestAuthPage() {
  const { user } = useAuth()
  const [testResult, setTestResult] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(false)

  const testAdminAuth = async () => {
    setLoading(true)
    try {
      // Get the session
      const { data: { session } } = await supabase.auth.getSession()
      console.log('Session:', session ? 'Found' : 'Not found')
      console.log('Access token:', session?.access_token ? 'Present' : 'Missing')

      if (!session?.access_token) {
        setTestResult({ error: 'No session or access token' })
        return
      }

      // Call the test API
      const response = await fetch('/api/admin/test', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      const result = await response.json()
      console.log('Test API result:', result)
      setTestResult(result)

    } catch (error) {
      console.error('Test error:', error)
      setTestResult({ error: error instanceof Error ? error.message : 'Unknown error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Authentication Test</h1>
        <p className="text-gray-600">Test admin authentication and permissions</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Current User Info</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p><strong>User ID:</strong> {user?.id || 'Not logged in'}</p>
            <p><strong>Email:</strong> {user?.email || 'Not logged in'}</p>
            <p><strong>Authenticated:</strong> {user ? 'Yes' : 'No'}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Admin API Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={testAdminAuth} 
            disabled={loading || !user}
          >
            {loading ? 'Testing...' : 'Test Admin Authentication'}
          </Button>

          {testResult && (
            <div className="mt-4 p-4 bg-gray-100 rounded-lg">
              <h3 className="font-semibold mb-2">Test Result:</h3>
              <pre className="text-sm overflow-auto">
                {JSON.stringify(testResult, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}