import { mockStudents, mockTasks } from "@/lib/mock-data";
import { Users, Pause, AlertCircle, CheckCircle } from "lucide-react";
import { motion } from "framer-motion";

export function StatsCards() {
  const active = mockStudents.filter(s => s.status === 'ativo').length;
  const onLeave = mockStudents.filter(s => s.status === 'licenca').length;
  const overdue = mockTasks.filter(t => t.status === 'atrasada').length;
  const pending = mockTasks.filter(t => t.status === 'pendente').length;

  const stats = [
    { label: "Alunos Ativos", value: active, icon: Users, color: "text-success" },
    { label: "Em Licença", value: onLeave, icon: Pause, color: "text-warning" },
    { label: "Tarefas Atrasadas", value: overdue, icon: AlertCircle, color: "text-destructive" },
    { label: "Tarefas Pendentes", value: pending, icon: CheckCircle, color: "text-info" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, i) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
          className="glass-card rounded-lg p-5"
        >
          <div className="flex items-center justify-between mb-2">
            <stat.icon className={`w-5 h-5 ${stat.color}`} />
          </div>
          <p className="text-2xl font-heading font-bold text-foreground">{stat.value}</p>
          <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
        </motion.div>
      ))}
    </div>
  );
}
