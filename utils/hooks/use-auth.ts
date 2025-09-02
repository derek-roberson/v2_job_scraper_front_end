import { useEffect } from 'react'
import { supabase } from '@/utils/supabase'
import { useAuthStore } from '@/utils/store/auth-store'

export function useAuth() {
  const { user, loading, setUser, setLoading } = useAuthStore()

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user ?? null)
      setLoading(false)
    }

    getInitialSession()

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [setUser, setLoading])

  const signIn = async (email: string, password: string) => {
    setLoading(true)
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    setLoading(false)
    return { data, error }
  }

  const signUp = async (email: string, password: string, retryCount = 0): Promise<any> => {
    setLoading(true)
    
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${process.env.NEXT_PUBLIC_FRONTEND_URL}/dashboard`
        }
      })
      
      // Handle rate limiting with exponential backoff
      if (error && error.status === 429 && retryCount < 3) {
        const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
        console.warn(`Rate limited. Retrying in ${delay}ms...`)
        setLoading(false)
        
        await new Promise(resolve => setTimeout(resolve, delay))
        return signUp(email, password, retryCount + 1)
      }
      
      // Handle specific error cases
      if (error && error.status === 429) {
        return { 
          data: null, 
          error: { 
            ...error, 
            message: 'Too many sign-up attempts. Please wait a few minutes and try again.' 
          } 
        }
      }
      
      setLoading(false)
      return { data, error }
    } catch (err) {
      setLoading(false)
      return { 
        data: null, 
        error: { 
          message: 'Network error. Please check your connection and try again.',
          status: 0
        } 
      }
    }
  }

  const signOut = async () => {
    setLoading(true)
    const { error } = await supabase.auth.signOut()
    setLoading(false)
    return { error }
  }

  return {
    user,
    loading,
    signIn,
    signUp,
    signOut,
    isAuthenticated: !!user
  }
}