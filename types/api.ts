// API request/response types for job scraper application

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
}

// Work type options
export interface WorkType {
  id: number
  name: string
  value: 'onsite' | 'hybrid' | 'remote'
}

// Location types
export interface USState {
  id: number
  name: string
  code: string
}

export interface USCity {
  id: number
  city: string
  state_name: string
  state_id: number
}

// Database entity types
export interface Query {
  id: number
  user_id: string
  keywords: string
  work_types: number[]
  city_id?: number
  location_string?: string
  is_active: boolean
  created_at: string
  updated_at: string
  us_cities?: USCity
}

export interface Job {
  id: number
  query_id?: number
  user_id: string
  title: string
  company: string
  link: string
  location?: string
  posted?: string
  scraped_at?: string
  is_deleted: boolean
  created_at: string
  description?: string
  salary?: string
  queries?: {
    id: number
    keywords: string
    location_string?: string
  }
}