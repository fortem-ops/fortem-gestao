import { Settings } from "lucide-react";

export default function Admin() {
  const items = ['Usuários', 'Permissões', 'Planos', 'Serviços', 'Tipos de Avaliação', 'Templates de Treino'];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground">Administração</h1>
        <p className="text-sm text-muted-foreground mt-1">Somente Coordenação e Administradores</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map(item => (
          <div key={item} className="glass-card rounded-lg p-5 hover:border-primary/30 cursor-pointer transition-colors">
            <Settings className="w-5 h-5 text-muted-foreground mb-2" />
            <p className="text-sm font-semibold text-foreground">{item}</p>
            <p className="text-xs text-muted-foreground mt-1">Gerenciar {item.toLowerCase()}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
