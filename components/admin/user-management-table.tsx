'use client'

import { useState, useEffect } from 'react'
import { useAdminUsers, useAdminUserMutations, type AdminUser } from '@/utils/hooks/use-admin'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  Edit, 
  Trash2, 
  Shield,
  Crown,
  User as UserIcon
} from 'lucide-react'
import { UserEditDialog } from './user-edit-dialog'

export function UserManagementTable() {
  const [filters, setFilters] = useState({
    page: 1,
    limit: 20,
    search: '',
    account_type: ''
  })
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null)
  const [deletingUser, setDeletingUser] = useState<AdminUser | null>(null)

  const { data, isLoading, error } = useAdminUsers({
    ...filters,
    search: debouncedSearch
  })
  const { deleteUser } = useAdminUserMutations()

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(filters.search)
    }, 300)
    return () => clearTimeout(timer)
  }, [filters.search])

  // Update stats when data changes
  useEffect(() => {
    if (data?.stats) {
      const updateElement = (id: string, value: number) => {
        const element = document.getElementById(id)
        if (element) element.textContent = value.toString()
      }
      
      updateElement('total-users', data.stats.totalUsers)
      updateElement('free-users', data.stats.freeUsers)
      updateElement('pro-users', data.stats.proUsers)
      updateElement('privileged-users', data.stats.privilegedUsers)
      updateElement('active-queries', data.stats.activeQueries)
    }
  }, [data?.stats])

  const handleDeleteUser = async () => {
    if (!deletingUser) return

    try {
      await deleteUser.mutateAsync(deletingUser.id)
      setDeletingUser(null)
    } catch (error) {
      console.error('Delete failed:', error)
      alert(error instanceof Error ? error.message : 'Failed to delete user')
    }
  }

  const getAccountTypeIcon = (accountType: string) => {
    switch (accountType) {
      case 'admin':
        return <Crown className="h-4 w-4 text-yellow-600" />
      case 'privileged':
        return <Shield className="h-4 w-4 text-blue-600" />
      default:
        return <UserIcon className="h-4 w-4 text-gray-500" />
    }
  }

  const getAccountTypeBadge = (accountType: string) => {
    switch (accountType) {
      case 'admin':
        return <Badge className="bg-yellow-500">Admin</Badge>
      case 'privileged':
        return <Badge className="bg-blue-500">Privileged</Badge>
      default:
        return <Badge variant="secondary">User</Badge>
    }
  }

  const getSubscriptionBadge = (tier: string, status?: string) => {
    if (status === 'active' && tier === 'pro') {
      return <Badge className="bg-green-500">Pro Active</Badge>
    }
    switch (tier) {
      case 'pro':
        return <Badge className="bg-blue-500">Pro ($10/month)</Badge>
      default:
        return <Badge variant="outline">Free</Badge>
    }
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">Error loading users. Please try again.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by email or name..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="pl-10"
          />
        </div>
        <Select 
          value={filters.account_type || 'all'} 
          onValueChange={(value) => setFilters({ ...filters, account_type: value === 'all' ? '' : value })}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Account Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="user">User</SelectItem>
            <SelectItem value="privileged">Privileged</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Account Type</TableHead>
              <TableHead>Subscription</TableHead>
              <TableHead>Queries</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  Loading users...
                </TableCell>
              </TableRow>
            ) : data?.users?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  No users found.
                </TableCell>
              </TableRow>
            ) : (
              data?.users?.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{user.full_name || 'No name'}</div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getAccountTypeIcon(user.account_type)}
                      {getAccountTypeBadge(user.account_type)}
                    </div>
                  </TableCell>
                  <TableCell>
                    {getSubscriptionBadge(user.subscription_tier, user.status)}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {user.max_active_queries === -1 ? 'Unlimited' : user.max_active_queries}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {new Date(user.created_at).toLocaleDateString()}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingUser(user)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      {user.account_type !== 'admin' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeletingUser(user)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {data?.pagination && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Showing {((data.pagination.page - 1) * data.pagination.limit) + 1} to{' '}
            {Math.min(data.pagination.page * data.pagination.limit, data.pagination.total)} of{' '}
            {data.pagination.total} users
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={data.pagination.page <= 1}
              onClick={() => setFilters({ ...filters, page: data.pagination.page - 1 })}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <span className="text-sm">
              Page {data.pagination.page} of {data.pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={data.pagination.page >= data.pagination.totalPages}
              onClick={() => setFilters({ ...filters, page: data.pagination.page + 1 })}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Edit User Dialog */}
      {editingUser && (
        <UserEditDialog
          user={editingUser}
          open={!!editingUser}
          onClose={() => setEditingUser(null)}
          onSave={() => {
            setEditingUser(null)
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletingUser} onOpenChange={() => setDeletingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {deletingUser?.email}? This action cannot be undone.
              All of their queries and jobs will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingUser(null)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteUser}
              disabled={deleteUser.isPending}
            >
              {deleteUser.isPending ? 'Deleting...' : 'Delete User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}