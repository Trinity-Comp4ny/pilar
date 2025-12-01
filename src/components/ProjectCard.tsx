import { MoreVertical, Users, Calendar } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ProjectCardProps {
  title: string;
  description: string;
  progress: number;
  status: "active" | "completed" | "delayed";
  team: number;
  deadline: string;
  delay?: number;
}

const ProjectCard = ({ title, description, progress, status, team, deadline, delay = 0 }: ProjectCardProps) => {
  const statusConfig = {
    active: { label: "Em Progresso", color: "bg-primary" },
    completed: { label: "Concluído", color: "bg-success" },
    delayed: { label: "Atrasado", color: "bg-destructive" },
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, delay }}
      className="bg-card border border-border rounded-xl p-6 hover:shadow-brutal transition-all duration-300 group"
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-display font-bold text-lg text-foreground group-hover:text-primary transition-colors">
            {title}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        </div>
        <button className="p-2 hover:bg-muted rounded-lg transition-colors">
          <MoreVertical className="w-4 h-4" />
        </button>
      </div>
      
      <div className="space-y-4">
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-medium text-muted-foreground">Progresso</span>
            <span className="text-xs font-bold text-foreground">{progress}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 1, delay: delay + 0.3 }}
              className={cn("h-full rounded-full", statusConfig[status].color)}
            />
          </div>
        </div>
        
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="w-4 h-4" />
              <span>{team}</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="w-4 h-4" />
              <span>{deadline}</span>
            </div>
          </div>
          <span className={cn(
            "text-xs font-medium px-3 py-1 rounded-full",
            statusConfig[status].color,
            "text-white"
          )}>
            {statusConfig[status].label}
          </span>
        </div>
      </div>
    </motion.div>
  );
};

export default ProjectCard;
