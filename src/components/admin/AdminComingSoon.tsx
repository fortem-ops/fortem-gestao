import { Construction } from "lucide-react";

export function AdminComingSoon({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
      <Construction className="w-12 h-12 mb-4 opacity-50" />
      <p className="text-lg font-medium">{title}</p>
      <p className="text-sm mt-1">Em breve esta funcionalidade estará disponível.</p>
    </div>
  );
}
