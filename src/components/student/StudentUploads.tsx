import type { Tables } from "@/integrations/supabase/types";
import { FileText, Image, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

const mockUploads = [
  { id: '1', name: 'Kinology_2026.pdf', type: 'PDF', date: '2026-03-01', author: 'Prof. Carlos' },
  { id: '2', name: 'exame_sangue.pdf', type: 'PDF', date: '2026-02-15', author: 'Nutri. Juliana' },
  { id: '3', name: 'postura_lateral.jpg', type: 'Imagem', date: '2026-01-20', author: 'Fisio. Rafael' },
];

export function StudentUploads({ student }: { student: Tables<"alunos"> }) {
  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <h3 className="font-heading font-semibold text-foreground">Uploads</h3>
        <Button size="sm"><Upload className="w-3 h-3 mr-1" /> Enviar Arquivo</Button>
      </div>
      <div className="space-y-2">
        {mockUploads.map(file => (
          <div key={file.id} className="glass-card rounded-lg p-3 flex items-center gap-3">
            {file.type === 'PDF' ? <FileText className="w-5 h-5 text-destructive shrink-0" /> : <Image className="w-5 h-5 text-info shrink-0" />}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
              <p className="text-xs text-muted-foreground">{file.date} · {file.author}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
