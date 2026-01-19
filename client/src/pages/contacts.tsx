import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Search,
  Plus,
  Upload,
  Download,
  MoreVertical,
  Users,
  Tag,
  List,
  Trash2,
  Edit,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Contact, ContactList, ContactTag } from "@shared/schema";

export default function Contacts() {
  const [searchQuery, setSearchQuery] = useState("");
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [addListOpen, setAddListOpen] = useState(false);
  const [addTagOpen, setAddTagOpen] = useState(false);
  const { toast } = useToast();

  const { data: contacts = [], isLoading: contactsLoading } = useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
  });

  const { data: lists = [], isLoading: listsLoading } = useQuery<ContactList[]>({
    queryKey: ["/api/lists"],
  });

  const { data: tags = [] } = useQuery<ContactTag[]>({
    queryKey: ["/api/tags"],
  });

  const createContactMutation = useMutation({
    mutationFn: async (data: { phone: string; name?: string }) => {
      return apiRequest("POST", "/api/contacts", data);
    },
    onSuccess: () => {
      toast({ title: "Contact added successfully" });
      setAddContactOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
    },
    onError: () => {
      toast({ title: "Failed to add contact", variant: "destructive" });
    },
  });

  const createListMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      return apiRequest("POST", "/api/lists", data);
    },
    onSuccess: () => {
      toast({ title: "List created successfully" });
      setAddListOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/lists"] });
    },
  });

  const createTagMutation = useMutation({
    mutationFn: async (data: { name: string; color: string }) => {
      return apiRequest("POST", "/api/tags", data);
    },
    onSuccess: () => {
      toast({ title: "Tag created successfully" });
      setAddTagOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/tags"] });
    },
  });

  const deleteContactMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/contacts/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Contact deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
    },
  });

  const deleteListMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/lists/${id}`);
    },
    onSuccess: () => {
      toast({ title: "List deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/lists"] });
    },
  });

  const deleteTagMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/tags/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Tag deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/tags"] });
    },
  });

  const contactForm = useForm({
    defaultValues: { phone: "", name: "" },
  });

  const listForm = useForm({
    defaultValues: { name: "", description: "" },
  });

  const tagForm = useForm({
    defaultValues: { name: "", color: "#22c55e" },
  });

  const filteredContacts = contacts.filter((c) =>
    c.phone.includes(searchQuery) || c.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const exportContacts = () => {
    const csv = [
      ["Phone", "Name", "Status"],
      ...contacts.map((c) => [c.phone, c.name || "", c.status]),
    ].map((row) => row.join(",")).join("\n");
    
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "contacts.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">Contacts</h1>
          <p className="text-sm text-muted-foreground">
            Manage your contacts, lists, and tags
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportContacts} data-testid="button-export-contacts">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" data-testid="button-import-contacts">
            <Upload className="h-4 w-4 mr-2" />
            Import CSV
          </Button>
        </div>
      </div>

      <Tabs defaultValue="contacts">
        <TabsList>
          <TabsTrigger value="contacts" data-testid="tab-contacts">
            <Users className="h-4 w-4 mr-2" />
            Contacts ({contacts.length})
          </TabsTrigger>
          <TabsTrigger value="lists" data-testid="tab-lists">
            <List className="h-4 w-4 mr-2" />
            Lists ({lists.length})
          </TabsTrigger>
          <TabsTrigger value="tags" data-testid="tab-tags">
            <Tag className="h-4 w-4 mr-2" />
            Tags ({tags.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="contacts" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search contacts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-contacts"
                />
              </div>
              <Dialog open={addContactOpen} onOpenChange={setAddContactOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-add-contact">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Contact
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Contact</DialogTitle>
                  </DialogHeader>
                  <Form {...contactForm}>
                    <form onSubmit={contactForm.handleSubmit((data) => createContactMutation.mutate(data))} className="space-y-4">
                      <FormField
                        control={contactForm.control}
                        name="phone"
                        rules={{ required: "Phone number is required" }}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone Number</FormLabel>
                            <FormControl>
                              <Input placeholder="+1234567890" {...field} data-testid="input-contact-phone" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={contactForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Name (optional)</FormLabel>
                            <FormControl>
                              <Input placeholder="Contact name" {...field} data-testid="input-contact-name" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <Button type="submit" className="w-full" disabled={createContactMutation.isPending} data-testid="button-submit-contact">
                        {createContactMutation.isPending ? "Adding..." : "Add Contact"}
                      </Button>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Phone</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Tags</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contactsLoading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center">Loading...</TableCell>
                      </TableRow>
                    ) : filteredContacts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          No contacts found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredContacts.map((contact) => (
                        <TableRow key={contact.id} data-testid={`contact-row-${contact.id}`}>
                          <TableCell className="font-mono">{contact.phone}</TableCell>
                          <TableCell>{contact.name || "-"}</TableCell>
                          <TableCell>
                            <Badge variant={contact.status === "subscribed" ? "default" : "secondary"}>
                              {contact.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {contact.tagIds?.length ? (
                              <div className="flex gap-1 flex-wrap">
                                {contact.tagIds.map((tagId) => {
                                  const tag = tags.find((t) => t.id === tagId);
                                  return tag ? (
                                    <Badge
                                      key={tag.id}
                                      variant="outline"
                                      style={{ borderColor: tag.color, color: tag.color }}
                                    >
                                      {tag.name}
                                    </Badge>
                                  ) : null;
                                })}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" data-testid={`button-contact-menu-${contact.id}`}>
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => deleteContactMutation.mutate(contact.id)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lists" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-4">
              <CardTitle className="text-lg">Contact Lists</CardTitle>
              <Dialog open={addListOpen} onOpenChange={setAddListOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-add-list">
                    <Plus className="h-4 w-4 mr-2" />
                    Create List
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New List</DialogTitle>
                  </DialogHeader>
                  <Form {...listForm}>
                    <form onSubmit={listForm.handleSubmit((data) => createListMutation.mutate(data))} className="space-y-4">
                      <FormField
                        control={listForm.control}
                        name="name"
                        rules={{ required: "List name is required" }}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Name</FormLabel>
                            <FormControl>
                              <Input placeholder="List name" {...field} data-testid="input-list-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={listForm.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description (optional)</FormLabel>
                            <FormControl>
                              <Input placeholder="List description" {...field} data-testid="input-list-description" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <Button type="submit" className="w-full" disabled={createListMutation.isPending} data-testid="button-submit-list">
                        {createListMutation.isPending ? "Creating..." : "Create List"}
                      </Button>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {listsLoading ? (
                  <div className="col-span-full text-center text-muted-foreground py-8">Loading...</div>
                ) : lists.length === 0 ? (
                  <div className="col-span-full text-center text-muted-foreground py-8">
                    No lists created yet
                  </div>
                ) : (
                  lists.map((list) => (
                    <Card key={list.id} className="hover-elevate" data-testid={`list-${list.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-medium">{list.name}</h3>
                            <p className="text-sm text-muted-foreground">{list.description || "No description"}</p>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>Edit</DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => deleteListMutation.mutate(list.id)}
                              >
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <div className="mt-4 flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{list.contactCount.toLocaleString()}</span>
                          <span className="text-sm text-muted-foreground">contacts</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tags" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-4">
              <CardTitle className="text-lg">Contact Tags</CardTitle>
              <Dialog open={addTagOpen} onOpenChange={setAddTagOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-add-tag">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Tag
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Tag</DialogTitle>
                  </DialogHeader>
                  <Form {...tagForm}>
                    <form onSubmit={tagForm.handleSubmit((data) => createTagMutation.mutate(data))} className="space-y-4">
                      <FormField
                        control={tagForm.control}
                        name="name"
                        rules={{ required: "Tag name is required" }}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Tag name" {...field} data-testid="input-tag-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={tagForm.control}
                        name="color"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Color</FormLabel>
                            <FormControl>
                              <div className="flex gap-2">
                                <Input type="color" {...field} className="w-12 h-9 p-1" data-testid="input-tag-color" />
                                <Input value={field.value} onChange={field.onChange} className="flex-1" />
                              </div>
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <Button type="submit" className="w-full" disabled={createTagMutation.isPending} data-testid="button-submit-tag">
                        {createTagMutation.isPending ? "Creating..." : "Create Tag"}
                      </Button>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {tags.length === 0 ? (
                  <div className="w-full text-center text-muted-foreground py-8">
                    No tags created yet
                  </div>
                ) : (
                  tags.map((tag) => (
                    <div
                      key={tag.id}
                      className="flex items-center gap-2 rounded-lg border p-3 hover-elevate"
                      data-testid={`tag-${tag.id}`}
                    >
                      <div
                        className="h-4 w-4 rounded-full"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="font-medium">{tag.name}</span>
                      <Badge variant="secondary" className="ml-2">{tag.contactCount}</Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6">
                            <MoreVertical className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => deleteTagMutation.mutate(tag.id)}
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
