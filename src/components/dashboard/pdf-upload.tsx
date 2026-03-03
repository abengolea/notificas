"use client";

import React, { useState, useRef } from 'react';
import { Upload, FileText, X, Eye, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

interface PDFFile {
  file: File;
  name: string;
  size: number;
  preview?: string;
}

interface PDFUploadProps {
  onFileSelect: (files: PDFFile[]) => void;
  maxFiles?: number;
  maxSizeMB?: number;
  acceptedTypes?: string[];
}

export function PDFUpload({ onFileSelect, maxFiles = 3, maxSizeMB = 10, acceptedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'] }: PDFUploadProps) {
  const [selectedFiles, setSelectedFiles] = useState<PDFFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  const validateFile = (file: File): string | null => {
    if (!acceptedTypes.includes(file.type)) {
      return 'Tipo de archivo no permitido. Formatos aceptados: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG, GIF';
    }
    if (file.size > maxSizeBytes) {
      return `El archivo es muy grande. Máximo ${maxSizeMB}MB`;
    }
    if (selectedFiles.length >= maxFiles) {
      return `Máximo ${maxFiles} archivos permitidos`;
    }
    return null;
  };

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;

    const newFiles: PDFFile[] = [];
    const errors: string[] = [];

    Array.from(files).forEach((file) => {
      const error = validateFile(file);
      if (error) {
        errors.push(`${file.name}: ${error}`);
        return;
      }

      const pdfFile: PDFFile = {
        file,
        name: file.name,
        size: file.size,
      };

      newFiles.push(pdfFile);
    });

    if (errors.length > 0) {
      toast({
        title: "Error al seleccionar archivos",
        description: errors.join(', '),
        variant: "destructive",
      });
    }

    if (newFiles.length > 0) {
      const updatedFiles = [...selectedFiles, ...newFiles];
      setSelectedFiles(updatedFiles);
      onFileSelect(updatedFiles);
      
      // Crear previews después de actualizar el estado
      newFiles.forEach((pdfFile) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          pdfFile.preview = e.target?.result as string;
          setSelectedFiles(prev => prev.map(f => f === pdfFile ? { ...f, preview: pdfFile.preview } : f));
        };
        reader.readAsDataURL(pdfFile.file);
      });
    }
  };

  const removeFile = (index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(newFiles);
    onFileSelect(newFiles);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="pdf-upload">Adjuntar Documentos</Label>
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-primary/50'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-sm text-muted-foreground mb-2">
            Arrastra documentos aquí o{' '}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-primary hover:underline font-medium"
            >
              selecciona archivos
            </button>
          </p>
          <p className="text-xs text-muted-foreground">
            Máximo {maxFiles} archivos, {maxSizeMB}MB cada uno
          </p>
          <p className="text-xs text-muted-foreground">
            Formatos: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG, GIF
          </p>
          <input
            ref={fileInputRef}
            id="pdf-upload"
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif"
            className="hidden"
            onChange={(e) => handleFileSelect(e.target.files)}
          />
        </div>
      </div>

      {selectedFiles.length > 0 && (
        <div className="space-y-3">
          <Label>Archivos seleccionados ({selectedFiles.length}/{maxFiles})</Label>
          {selectedFiles.map((file, index) => (
            <Card key={index} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <FileText className="h-8 w-8 text-red-500" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(file.size)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant="secondary" className="text-xs">
                      {file.name.split('.').pop()?.toUpperCase() || 'DOC'}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (file.preview) {
                          window.open(file.preview, '_blank');
                        }
                      }}
                      disabled={!file.preview}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
