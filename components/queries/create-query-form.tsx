'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { useStates, useCities } from '@/utils/hooks/use-locations'

interface CreateQueryFormProps {
  onSubmit: (data: {
    keywords: string
    work_types: number[]
    state?: string
    city?: string
  }) => void
  onCancel?: () => void
  loading?: boolean
}

export function CreateQueryForm({ onSubmit, onCancel, loading }: CreateQueryFormProps) {
  const [keywords, setKeywords] = useState('')
  const [selectedStateId, setSelectedStateId] = useState<number | undefined>()
  const [selectedCityId, setSelectedCityId] = useState<number | undefined>()
  const [workTypes, setWorkTypes] = useState<number[]>([])

  // Load states and cities from database
  const { data: states = [], isLoading: statesLoading } = useStates()
  const { data: cities = [], isLoading: citiesLoading } = useCities(selectedStateId)

  const workTypeOptions = [
    { id: 1, name: 'On-site' },
    { id: 2, name: 'Hybrid' },
    { id: 3, name: 'Remote' },
  ]

  const selectedState = states.find(s => s.id === selectedStateId)
  const selectedCity = cities.find(c => c.id === selectedCityId)

  const handleWorkTypeChange = (workTypeId: number, checked: boolean) => {
    setWorkTypes(prev => 
      checked 
        ? [...prev, workTypeId]
        : prev.filter(id => id !== workTypeId)
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      keywords,
      work_types: workTypes,
      state: selectedState?.name || undefined,
      city: selectedCity?.city || undefined,
    })
  }

  // Reset city when state changes
  const handleStateChange = (stateId: string) => {
    const id = parseInt(stateId)
    setSelectedStateId(id)
    setSelectedCityId(undefined) // Clear city selection
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Job Query</CardTitle>
        <CardDescription>
          Set up automated job search with your preferred criteria
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Keywords */}
          <div className="space-y-2">
            <Label htmlFor="keywords">Keywords</Label>
            <Input
              id="keywords"
              placeholder="e.g., Software Engineer, React, TypeScript"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              required
            />
            <p className="text-sm text-gray-600">
              Enter job titles, skills, or keywords separated by commas
            </p>
          </div>

          {/* Work Types */}
          <div className="space-y-3">
            <Label>Work Arrangement</Label>
            <div className="space-y-2">
              {workTypeOptions.map((workType) => (
                <div key={workType.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`worktype-${workType.id}`}
                    checked={workTypes.includes(workType.id)}
                    onCheckedChange={(checked) => 
                      handleWorkTypeChange(workType.id, checked as boolean)
                    }
                  />
                  <Label htmlFor={`worktype-${workType.id}`}>{workType.name}</Label>
                </div>
              ))}
            </div>
          </div>

          {/* Location */}
          <div className="space-y-4">
            <Label>Location (Optional)</Label>
            
            {/* State Selector */}
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Select 
                value={selectedStateId?.toString() || ''} 
                onValueChange={handleStateChange}
                disabled={statesLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder={
                    statesLoading ? "Loading states..." : "Select a state..."
                  } />
                </SelectTrigger>
                <SelectContent>
                  {states.map((state) => (
                    <SelectItem key={state.id} value={state.id.toString()}>
                      {state.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* City Selector */}
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Select 
                value={selectedCityId?.toString() || ''} 
                onValueChange={(cityId) => setSelectedCityId(parseInt(cityId))}
                disabled={!selectedStateId || citiesLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder={
                    !selectedStateId 
                      ? "Select a state first..." 
                      : citiesLoading
                      ? "Loading cities..."
                      : "Select a city..."
                  } />
                </SelectTrigger>
                <SelectContent>
                  {cities.map((city) => (
                    <SelectItem key={city.id} value={city.id.toString()}>
                      {city.city}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={loading || !keywords || workTypes.length === 0}>
              {loading ? 'Creating...' : 'Create Query'}
            </Button>
            <Button 
              type="button" 
              variant="outline"
              onClick={onCancel}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}