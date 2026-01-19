import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, RefreshCw, Search, MoreHorizontal, Eye, Copy, Trash2, Filter } from "lucide-react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Template, InsertTemplate } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";

const templateFormSchema = z.object({
  name: z.string().min(1, "Template name is required").max(512),
  category: z.enum(["MARKETING", "UTILITY", "AUTHENTICATION"]),
  language: z.string().min(1, "Language is required"),
  bodyText: z.string().min(1, "Message body is required").max(1024),
  headerText: z.string().max(60).optional(),
  footerText: z.string().max(60).optional(),
});

type TemplateFormValues = z.infer<typeof templateFormSchema>;

export default function Templates() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const { toast } = useToast();

  const { data: templates = [], isLoading, refetch, isRefetching } = useQuery<Template[]>({
    queryKey: ["/api/templates"],
  });

  const form = useForm<TemplateFormValues>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: {
      name: "",
      category: "MARKETING",
      language: "en",
      bodyText: "",
      headerText: "",
      footerText: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: TemplateFormValues) => {
      const template: Partial<InsertTemplate> = {
        name: data.name,
        category: data.category,
        language: data.language,
        status: "PENDING",
        components: [
          ...(data.headerText ? [{ type: "HEADER" as const, text: data.headerText }] : []),
          { type: "BODY" as const, text: data.bodyText },
          ...(data.footerText ? [{ type: "FOOTER" as const, text: data.footerText }] : []),
        ],
      };
      return apiRequest("POST", "/api/templates", template);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      setCreateDialogOpen(false);
      form.reset();
      toast({
        title: "Template Created",
        description: "Your template has been submitted for approval.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create template. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      toast({
        title: "Template Deleted",
        description: "The template has been removed.",
      });
    },
  });

  const handleRefresh = () => {
    refetch();
    toast({
      title: "Syncing Templates",
      description: "Fetching latest template statuses from Meta...",
    });
  };

  const filteredTemplates = templates.filter((template) => {
    const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || template.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusCounts = {
    all: templates.length,
    APPROVED: templates.filter((t) => t.status === "APPROVED").length,
    PENDING: templates.filter((t) => t.status === "PENDING").length,
    REJECTED: templates.filter((t) => t.status === "REJECTED").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Templates</h1>
          <p className="text-sm text-muted-foreground">
            Manage your WhatsApp message templates
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="default"
            onClick={handleRefresh}
            disabled={isRefetching}
            data-testid="button-refresh-templates"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? "animate-spin" : ""}`} />
            Sync
          </Button>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-template">
                <Plus className="h-4 w-4 mr-2" />
                Create Template
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Template</DialogTitle>
                <DialogDescription>
                  Create a new message template. Templates require Meta approval before use.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Template Name</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="e.g., order_confirmation" 
                              data-testid="input-template-name"
                              {...field} 
                            />
                          </FormControl>
                          <FormDescription>Use lowercase with underscores</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Category</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-category">
                                <SelectValue placeholder="Select category" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="MARKETING">Marketing</SelectItem>
                              <SelectItem value="UTILITY">Utility</SelectItem>
                              <SelectItem value="AUTHENTICATION">Authentication</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="language"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Language</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-language">
                              <SelectValue placeholder="Select language" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="en">English</SelectItem>
                            <SelectItem value="es">Spanish</SelectItem>
                            <SelectItem value="pt">Portuguese</SelectItem>
                            <SelectItem value="fr">French</SelectItem>
                            <SelectItem value="de">German</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="headerText"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Header (Optional)</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g., Order Update" 
                            maxLength={60}
                            data-testid="input-header-text"
                            {...field} 
                          />
                        </FormControl>
                        <FormDescription>{field.value?.length || 0}/60 characters</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="bodyText"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Message Body</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Enter your message. Use {{1}}, {{2}} for variables."
                            className="min-h-[120px] resize-none"
                            maxLength={1024}
                            data-testid="input-body-text"
                            {...field} 
                          />
                        </FormControl>
                        <FormDescription>
                          {field.value?.length || 0}/1024 characters. Use {"{{1}}"}, {"{{2}}"} for dynamic content.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="footerText"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Footer (Optional)</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g., Reply STOP to unsubscribe" 
                            maxLength={60}
                            data-testid="input-footer-text"
                            {...field} 
                          />
                        </FormControl>
                        <FormDescription>{field.value?.length || 0}/60 characters</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <DialogFooter>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setCreateDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={createMutation.isPending}
                      data-testid="button-submit-template"
                    >
                      {createMutation.isPending ? "Creating..." : "Create Template"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-templates"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40" data-testid="select-status-filter">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All ({statusCounts.all})</SelectItem>
              <SelectItem value="APPROVED">Approved ({statusCounts.APPROVED})</SelectItem>
              <SelectItem value="PENDING">Pending ({statusCounts.PENDING})</SelectItem>
              <SelectItem value="REJECTED">Rejected ({statusCounts.REJECTED})</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Templates Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <TemplatesTableSkeleton />
          ) : filteredTemplates.length === 0 ? (
            <div className="py-16 text-center">
              <FileTextIcon className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">No templates found</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {searchQuery || statusFilter !== "all" 
                  ? "Try adjusting your filters"
                  : "Create your first template to get started"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[250px]">Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Language</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Quality</TableHead>
                  <TableHead>Last Synced</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTemplates.map((template) => (
                  <TableRow 
                    key={template.id}
                    data-testid={`template-row-${template.id}`}
                  >
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-medium font-mono text-sm">{template.name}</p>
                        {template.metaTemplateId && (
                          <p className="text-xs text-muted-foreground font-mono">
                            ID: {template.metaTemplateId}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {template.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="uppercase text-xs font-medium">
                      {template.language}
                    </TableCell>
                    <TableCell>
                      <StatusBadge 
                        status={template.status as any} 
                        type="template" 
                        pulse={template.status === "PENDING"}
                        size="sm"
                      />
                    </TableCell>
                    <TableCell>
                      <StatusBadge 
                        status={(template.qualityScore || "UNKNOWN") as any} 
                        type="quality"
                        size="sm"
                        showIcon={false}
                      />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {template.lastSyncedAt 
                        ? format(new Date(template.lastSyncedAt), "MMM d, h:mm a")
                        : "Never"
                      }
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            data-testid={`button-template-actions-${template.id}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setSelectedTemplate(template)}>
                            <Eye className="h-4 w-4 mr-2" />
                            Preview
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Copy className="h-4 w-4 mr-2" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="text-destructive"
                            onClick={() => deleteMutation.mutate(template.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Template Preview Dialog */}
      <Dialog open={!!selectedTemplate} onOpenChange={() => setSelectedTemplate(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Template Preview</DialogTitle>
            <DialogDescription>
              {selectedTemplate?.name}
            </DialogDescription>
          </DialogHeader>
          {selectedTemplate && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted p-4">
                <div className="bg-background rounded-lg p-4 shadow-sm border max-w-xs mx-auto">
                  {selectedTemplate.components?.map((component, i) => (
                    <div key={i} className="text-sm">
                      {component.type === "HEADER" && (
                        <p className="font-semibold mb-2">{component.text}</p>
                      )}
                      {component.type === "BODY" && (
                        <p className="text-foreground">{component.text}</p>
                      )}
                      {component.type === "FOOTER" && (
                        <p className="text-xs text-muted-foreground mt-2">{component.text}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <StatusBadge status={selectedTemplate.status as any} type="template" size="sm" />
                </div>
                <div>
                  <p className="text-muted-foreground">Category</p>
                  <p className="font-medium">{selectedTemplate.category}</p>
                </div>
              </div>
              {selectedTemplate.rejectionReason && (
                <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                  <p className="font-medium">Rejection Reason:</p>
                  <p>{selectedTemplate.rejectionReason}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FileTextIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function TemplatesTableSkeleton() {
  return (
    <div className="p-4 space-y-4">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-6 w-12" />
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-8 w-8 ml-auto" />
        </div>
      ))}
    </div>
  );
}
