import { AssistantDrawerProvider } from "@/components/admin/marketing/assistant-drawer";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <AssistantDrawerProvider>{children}</AssistantDrawerProvider>;
}
