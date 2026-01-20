import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Users, 
  UserCheck, 
  UserX, 
  CreditCard, 
  Shield, 
  Search,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown
} from "lucide-react";
import type { User } from "@shared/models/auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  trialUsers: number;
  paidUsers: number;
  pendingApproval: number;
}

export default function Admin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Check if bootstrap is available (no super admin exists yet)
  const { data: bootstrapData } = useQuery<{ available: boolean }>({
    queryKey: ["/api/admin/bootstrap-available"],
  });

  const bootstrapMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/admin/bootstrap", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bootstrap-available"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: "Success", description: "You are now a Super Admin!" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to claim super admin role", variant: "destructive" });
    },
  });

  const { data: stats, isLoading: statsLoading } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
  });

  const { data: users = [], isLoading: usersLoading, error: usersError } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      return apiRequest("PATCH", `/api/admin/users/${userId}/role`, { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Success", description: "User role updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update user role", variant: "destructive" });
    },
  });

  const updateAccessMutation = useMutation({
    mutationFn: async ({ userId, grantedFreeAccess, subscriptionStatus }: { 
      userId: string; 
      grantedFreeAccess?: boolean;
      subscriptionStatus?: string;
    }) => {
      return apiRequest("PATCH", `/api/admin/users/${userId}/access`, { grantedFreeAccess, subscriptionStatus });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Success", description: "User access updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update user access", variant: "destructive" });
    },
  });

  const filteredUsers = users.filter((user) => {
    const matchesSearch = 
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.lastName?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    const matchesStatus = statusFilter === "all" || user.subscriptionStatus === statusFilter;
    
    return matchesSearch && matchesRole && matchesStatus;
  });

  const getStatusBadge = (user: User) => {
    if (user.grantedFreeAccess) {
      return <Badge variant="default" className="bg-green-600">Free Access</Badge>;
    }
    if (user.subscriptionStatus === "active") {
      return <Badge variant="default" className="bg-green-600">Active</Badge>;
    }
    if (user.subscriptionStatus === "trial") {
      return <Badge variant="secondary">Trial</Badge>;
    }
    if (user.subscriptionStatus === "cancelled") {
      return <Badge variant="destructive">Cancelled</Badge>;
    }
    return <Badge variant="outline">Inactive</Badge>;
  };

  const getRoleBadge = (role: string) => {
    if (role === "super_admin") {
      return <Badge className="bg-purple-600">Super Admin</Badge>;
    }
    if (role === "admin") {
      return <Badge className="bg-blue-600">Admin</Badge>;
    }
    return <Badge variant="outline">User</Badge>;
  };

  if (usersError) {
    const errorMessage = (usersError as Error).message || "";
    const isForbidden = errorMessage.includes("403") || errorMessage.includes("Forbidden");
    const isUnauthorized = errorMessage.includes("401") || errorMessage.includes("Unauthorized");
    
    if (isForbidden || isUnauthorized) {
      // Show bootstrap option if no super admin exists yet
      if (bootstrapData?.available) {
        return (
          <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
            <Shield className="h-16 w-16 text-primary" />
            <h2 className="text-2xl font-semibold">Claim Super Admin Role</h2>
            <p className="text-muted-foreground">No super admin has been set up yet.</p>
            <p className="text-sm text-muted-foreground">As the first user, you can claim the super admin role to manage the platform.</p>
            <Button 
              onClick={() => bootstrapMutation.mutate()}
              disabled={bootstrapMutation.isPending}
              data-testid="button-claim-super-admin"
            >
              {bootstrapMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Claiming...
                </>
              ) : (
                <>
                  <Shield className="h-4 w-4 mr-2" /> Claim Super Admin Role
                </>
              )}
            </Button>
          </div>
        );
      }
      
      return (
        <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
          <Shield className="h-16 w-16 text-muted-foreground" />
          <h2 className="text-2xl font-semibold">Access Denied</h2>
          <p className="text-muted-foreground">You don't have permission to access this page.</p>
          <p className="text-sm text-muted-foreground">Only Super Admins can access the admin dashboard.</p>
        </div>
      );
    }
    
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <XCircle className="h-16 w-16 text-destructive" />
        <h2 className="text-2xl font-semibold">Error Loading Admin Dashboard</h2>
        <p className="text-muted-foreground">Failed to load user data. Please try again.</p>
        <Button 
          onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] })}
          data-testid="button-retry"
        >
          <RefreshCw className="h-4 w-4 mr-2" /> Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-admin-title">Admin Dashboard</h1>
        <p className="text-muted-foreground">Manage users, subscriptions, and platform access</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-users">{stats?.totalUsers || 0}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <UserCheck className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="text-active-users">{stats?.activeUsers || 0}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Trial Users</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600" data-testid="text-trial-users">{stats?.trialUsers || 0}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paid Users</CardTitle>
            <CreditCard className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600" data-testid="text-paid-users">{stats?.paidUsers || 0}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Approval</CardTitle>
            <UserX className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600" data-testid="text-pending-users">{stats?.pendingApproval || 0}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>User Management</CardTitle>
          <CardDescription>View and manage all registered users</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search-users"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[150px]" data-testid="select-role-filter">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="super_admin">Super Admin</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="user">User</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]" data-testid="select-status-filter">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="trial">Trial</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
                queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
              }}
              data-testid="button-refresh-users"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          {usersLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No users found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((user) => (
                      <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                              <AvatarImage src={user.profileImageUrl || undefined} />
                              <AvatarFallback>
                                {user.firstName?.[0] || user.email?.[0] || "U"}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">
                                {user.firstName} {user.lastName}
                              </p>
                              <p className="text-sm text-muted-foreground">{user.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{getRoleBadge(user.role)}</TableCell>
                        <TableCell>{getStatusBadge(user)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "N/A"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" data-testid={`button-role-${user.id}`}>
                                  Role <ChevronDown className="ml-1 h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem 
                                  onClick={() => updateRoleMutation.mutate({ userId: user.id, role: "user" })}
                                >
                                  Set as User
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => updateRoleMutation.mutate({ userId: user.id, role: "admin" })}
                                >
                                  Set as Admin
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => updateRoleMutation.mutate({ userId: user.id, role: "super_admin" })}
                                >
                                  Set as Super Admin
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                            
                            <Button
                              variant={user.grantedFreeAccess ? "destructive" : "default"}
                              size="sm"
                              onClick={() => updateAccessMutation.mutate({ 
                                userId: user.id, 
                                grantedFreeAccess: !user.grantedFreeAccess,
                                subscriptionStatus: !user.grantedFreeAccess ? "active" : "inactive"
                              })}
                              disabled={updateAccessMutation.isPending}
                              data-testid={`button-access-${user.id}`}
                            >
                              {user.grantedFreeAccess ? (
                                <>
                                  <XCircle className="h-4 w-4 mr-1" /> Revoke
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
                                </>
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
