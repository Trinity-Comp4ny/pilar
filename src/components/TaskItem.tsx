import { motion } from "framer-motion";
import { CheckCircle2, Circle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface TaskItemProps {
  title: string;
  priority: "high" | "medium" | "low";
  completed: boolean;
  dueDate: string;
  onToggle: () => void;
  delay?: number;
}

const TaskItem = ({ title, priority, completed, dueDate, onToggle, delay = 0 }: TaskItemProps) => {
  const priorityConfig = {
    high: { color: "text-destructive", bgColor: "bg-destructive/10", label: "Alta" },
    medium: { color: "text-warning", bgColor: "bg-warning/10", label: "Média" },
    low: { color: "text-success", bgColor: "bg-success/10", label: "Baixa" },
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay }}
      className={cn(
        "flex items-center gap-4 p-4 bg-card border border-border rounded-lg",
        "hover:shadow-subtle transition-all duration-200",
        completed && "opacity-60"
      )}
    >
      <button
        onClick={onToggle}
        className="flex-shrink-0 transition-transform duration-200 hover:scale-110"
      >
        {completed ? (
          <CheckCircle2 className="w-6 h-6 text-success" />
        ) : (
          <Circle className="w-6 h-6 text-muted-foreground hover:text-primary" />
        )}
      </button>
      
      <div className="flex-1 min-w-0">
        <p className={cn(
          "font-medium",
          completed && "line-through text-muted-foreground"
        )}>
          {title}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span className={cn(
            "text-xs font-medium px-2 py-0.5 rounded-full",
            priorityConfig[priority].bgColor,
            priorityConfig[priority].color
          )}>
            {priorityConfig[priority].label}
          </span>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span>{dueDate}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default TaskItem;
