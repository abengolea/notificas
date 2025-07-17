"use client"

import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, Send } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from "@/components/ui/select"
import { Checkbox } from "../ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import { useState } from "react"

const messageSchema = z.object({
  recipient: z.string().email({ message: "Invalid email address." }),
  content: z.string().min(10, { message: "Message must be at least 10 characters." }),
  priority: z.enum(["normal", "alta", "urgente"]),
  requireCertificate: z.boolean(),
})

type MessageFormValues = z.infer<typeof messageSchema>

export function ComposeMessageDialog({ children, open, onOpenChange }: { children: React.ReactNode, open: boolean, onOpenChange: (open: boolean) => void }) {
    const [isSending, setIsSending] = useState(false);
    const { toast } = useToast();
    const form = useForm<MessageFormValues>({
        resolver: zodResolver(messageSchema),
        defaultValues: {
            recipient: "",
            content: "",
            priority: "normal",
            requireCertificate: true,
        },
    });

    const onSubmit = async (data: MessageFormValues) => {
        setIsSending(true);
        console.log("Sending message:", data);
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 2000));
        setIsSending(false);
        onOpenChange(false);
        toast({
            title: "Message Sent & Certified",
            description: "Your message has been sent and certified on BFA.",
            variant: "default",
        });
        form.reset();
    }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Compose New Certified Message</DialogTitle>
          <DialogDescription>
            This message will be encrypted and certified on Blockchain Federal Argentina.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-2">
                <Label htmlFor="recipient">Recipient Email</Label>
                <Input id="recipient" {...form.register("recipient")} placeholder="recipient@example.com" />
                {form.formState.errors.recipient && <p className="text-sm text-destructive">{form.formState.errors.recipient.message}</p>}
            </div>
            <div className="grid gap-2">
                <Label htmlFor="content">Message Content</Label>
                <Textarea id="content" {...form.register("content")} placeholder="Type your certified message here." className="min-h-[150px]" />
                {form.formState.errors.content && <p className="text-sm text-destructive">{form.formState.errors.content.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                    <Label htmlFor="priority">Priority</Label>
                     <Select onValueChange={(value) => form.setValue('priority', value as "normal" | "alta" | "urgente")} defaultValue="normal">
                        <SelectTrigger>
                            <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="normal">Normal</SelectItem>
                            <SelectItem value="alta">High</SelectItem>
                            <SelectItem value="urgente">Urgent</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex items-end pb-2">
                     <div className="flex items-center space-x-2">
                        <Checkbox id="require-certificate" {...form.register("requireCertificate")} defaultChecked={true} />
                        <Label htmlFor="require-certificate" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                            Require Certificate
                        </Label>
                    </div>
                </div>
            </div>

            <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSending}>
                {isSending ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                    </>
                ) : (
                    <>
                        <Send className="mr-2 h-4 w-4" />
                        Send Certified Message
                    </>
                )}
            </Button>
            </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
