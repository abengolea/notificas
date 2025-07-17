"use client";

import { CheckCircle2, Copy, ExternalLink, FileText, Fingerprint, MousePointerSquare, Stamp, XCircle } from 'lucide-react';
import type { Mensaje } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface BfaTraceabilityProps {
  message: Mensaje;
}

const TraceabilityItem = ({ title, timestamp, data, statusIcon }: { title: string, timestamp?: Date, data: { label: string, value: string, icon: React.ReactNode }[], statusIcon: React.ReactNode }) => {
  const { toast } = useToast();

  const handleCopy = (value: string) => {
    navigator.clipboard.writeText(value);
    toast({ title: 'Copied to clipboard!', variant: 'default' });
  };

  return (
    <div className="relative pl-8">
      <div className="absolute left-0 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-background">{statusIcon}</div>
      <div className="flex flex-col">
        <div className="font-semibold text-foreground">{title}</div>
        {timestamp && <div className="text-sm text-muted-foreground">{new Date(timestamp).toLocaleString()}</div>}
        <div className="mt-2 space-y-2 text-sm">
          {data.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              <div className="flex items-center w-32 text-muted-foreground">
                {item.icon}
                <span className="ml-2">{item.label}</span>
              </div>
              <div className="flex-1 font-mono text-xs bg-muted/50 px-2 py-1 rounded-md flex items-center justify-between">
                <span className="truncate">{item.value}</span>
                <div className="flex items-center">
                   <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleCopy(item.value)}>
                    <Copy className="h-3 w-3" />
                  </Button>
                  {item.label === 'Verify' && (
                    <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
                      <a href={item.value} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default function BfaTraceability({ message }: BfaTraceabilityProps) {
  const sentData = [
    { label: 'Hash BFA', value: message.bfaEnviado.hashRegistrado, icon: <Fingerprint className="h-4 w-4" /> },
    { label: 'Stamp ID', value: message.bfaEnviado.stampId, icon: <Stamp className="h-4 w-4" /> },
    { label: 'Verify', value: message.bfaEnviado.verificacionUrl, icon: <CheckCircle2 className="h-4 w-4" /> },
  ];

  const readData = message.bfaLeido ? [
    { label: 'Hash BFA', value: message.bfaLeido.hashRegistrado, icon: <Fingerprint className="h-4 w-4" /> },
    { label: 'Stamp ID', value: message.bfaLeido.stampId, icon: <Stamp className="h-4 w-4" /> },
    { label: 'IP Address', value: message.bfaLeido.ipLector, icon: <MousePointerSquare className="h-4 w-4" /> },
    { label: 'Device', value: message.bfaLeido.dispositivoLector.substring(0,25)+'...', icon: <FileText className="h-4 w-4" /> },
    { label: 'Verify', value: message.bfaLeido.verificacionUrl, icon: <CheckCircle2 className="h-4 w-4" /> },
  ] : [];
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Certified Traceability</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative space-y-8">
            <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-border -z-10"></div>
            <TraceabilityItem title="Sent" timestamp={message.bfaEnviado.timestamp} data={sentData} statusIcon={<CheckCircle2 className="h-5 w-5 text-primary" />} />
            {message.bfaLeido ? (
                <TraceabilityItem title="Read" timestamp={message.bfaLeido.timestamp} data={readData} statusIcon={<CheckCircle2 className="h-5 w-5 text-accent" />} />
            ) : (
                <TraceabilityItem title="Pending Read" data={[]} statusIcon={<XCircle className="h-5 w-5 text-muted-foreground" />} />
            )}
        </div>
      </CardContent>
    </Card>
  );
}
