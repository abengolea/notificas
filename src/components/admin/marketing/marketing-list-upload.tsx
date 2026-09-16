"use client";

import { useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export const MARKETING_CSV_TEMPLATE =
  "email,nombre,empresa,cargo,pais,notas\ncontacto@empresa.cl,Ana Pérez,Empresa Sur,Gerente,CL,\n";

export type ImportedList = {
  listId: string;
  listName: string;
  created: number;
  updated: number;
};

export function MarketingListUpload({
  defaultName,
  onImported,
}: {
  defaultName?: string;
  onImported: (list: ImportedList) => void;
}) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [listName, setListName] = useState(defaultName || "");
  const [importing, setImporting] = useState(false);

  async function onFile(file: File) {
    const name = listName.trim() || defaultName?.trim() || file.name.replace(/\.csv$/i, "");
    if (name.length < 2) {
      toast({ title: "Poné un nombre a esta lista", variant: "destructive" });
      return;
    }
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("listName", name);
      const res = await fetch("/api/admin/marketing/contacts/import", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo importar");
      const listId = String(data.listId || "");
      if (!listId) throw new Error("La importación no devolvió la lista");
      setListName(String(data.listName || name));
      toast({
        title: `Lista “${data.listName || name}”: ${data.created} nuevos, ${data.updated} actualizados`,
        description: data.errorCount ? `${data.errorCount} filas con error` : undefined,
      });
      onImported({
        listId,
        listName: String(data.listName || name),
        created: Number(data.created || 0),
        updated: Number(data.updated || 0),
      });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Error", variant: "destructive" });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
      <div>
        <p className="text-sm font-medium">Cargar destinatarios (CSV)</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Columnas: email, nombre, empresa, cargo, pais (AR, CL, BR…). Esta lista es la que recibe el correo.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1">
          <Label htmlFor="camp-list-name">Nombre de la lista</Label>
          <Input
            id="camp-list-name"
            value={listName}
            onChange={(e) => setListName(e.target.value)}
            placeholder="Ej. Chile — clínicas marzo"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" asChild>
            <a href={`data:text/csv;charset=utf-8,${encodeURIComponent(MARKETING_CSV_TEMPLATE)}`} download="destinatarios-marketing.csv">
              Plantilla CSV
            </a>
          </Button>
          <Button type="button" variant="secondary" className="relative" disabled={importing}>
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            <span className="ml-2">Importar CSV</span>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="absolute inset-0 cursor-pointer opacity-0"
              aria-label="Importar CSV de destinatarios"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void onFile(file);
              }}
            />
          </Button>
        </div>
      </div>
    </div>
  );
}
