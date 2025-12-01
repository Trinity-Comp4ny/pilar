import { useState } from "react";
import { motion } from "framer-motion";
import { FolderKanban, CheckCircle2, Clock, TrendingUp } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import MetricCard from "@/components/MetricCard";
import ProjectCard from "@/components/ProjectCard";
import TaskItem from "@/components/TaskItem";

const Index = () => {
  const [activeSection, setActiveSection] = useState("dashboard");
  const [tasks, setTasks] = useState([
    { id: 1, title: "Revisar proposta do cliente", priority: "high" as const, completed: false, dueDate: "Hoje" },
    { id: 2, title: "Atualizar documentação técnica", priority: "medium" as const, completed: false, dueDate: "Amanhã" },
    { id: 3, title: "Reunião com equipe de design", priority: "high" as const, completed: true, dueDate: "Ontem" },
    { id: 4, title: "Implementar feedback do sprint", priority: "medium" as const, completed: false, dueDate: "Sexta" },
    { id: 5, title: "Code review - módulo de pagamentos", priority: "low" as const, completed: false, dueDate: "Segunda" },
  ]);

  const toggleTask = (id: number) => {
    setTasks(tasks.map(task => 
      task.id === id ? { ...task, completed: !task.completed } : task
    ));
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar activeSection={activeSection} onSectionChange={setActiveSection} />
      
      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-8"
          >
            <h1 className="text-4xl font-display font-bold mb-2">
              Dashboard
            </h1>
            <p className="text-muted-foreground">
              Visão geral dos seus projetos e tarefas
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <MetricCard
              title="Projetos Ativos"
              value={12}
              icon={FolderKanban}
              trend="+3 este mês"
              delay={0.1}
            />
            <MetricCard
              title="Tarefas Concluídas"
              value={48}
              icon={CheckCircle2}
              trend="+12 esta semana"
              delay={0.2}
            />
            <MetricCard
              title="Prazo Médio"
              value="5d"
              icon={Clock}
              delay={0.3}
            />
            <MetricCard
              title="Produtividade"
              value="94%"
              icon={TrendingUp}
              trend="+8%"
              delay={0.4}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
            >
              <h2 className="text-2xl font-display font-bold mb-4">Projetos em Destaque</h2>
              <div className="space-y-4">
                <ProjectCard
                  title="Redesign do Sistema"
                  description="Modernização da interface e UX"
                  progress={75}
                  status="active"
                  team={5}
                  deadline="15 Dez"
                  delay={0.1}
                />
                <ProjectCard
                  title="API Gateway v2"
                  description="Nova versão com microserviços"
                  progress={100}
                  status="completed"
                  team={3}
                  deadline="10 Dez"
                  delay={0.2}
                />
                <ProjectCard
                  title="App Mobile"
                  description="Aplicativo nativo iOS e Android"
                  progress={45}
                  status="delayed"
                  team={7}
                  deadline="08 Dez"
                  delay={0.3}
                />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.6 }}
            >
              <h2 className="text-2xl font-display font-bold mb-4">Tarefas Recentes</h2>
              <div className="space-y-3">
                {tasks.map((task, index) => (
                  <TaskItem
                    key={task.id}
                    title={task.title}
                    priority={task.priority}
                    completed={task.completed}
                    dueDate={task.dueDate}
                    onToggle={() => toggleTask(task.id)}
                    delay={index * 0.1}
                  />
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
