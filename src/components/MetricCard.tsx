import { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  delay?: number;
}

const MetricCard = ({ title, value, icon: Icon, trend, delay = 0 }: MetricCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className="bg-card border border-border rounded-xl p-6 hover:shadow-subtle transition-all duration-300 hover:-translate-y-1"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="p-3 bg-primary/10 rounded-lg">
          <Icon className="w-6 h-6 text-primary" />
        </div>
        {trend && (
          <span className="text-xs font-medium text-success px-2 py-1 bg-success/10 rounded-full">
            {trend}
          </span>
        )}
      </div>
      
      <h3 className="text-sm text-muted-foreground mb-2">{title}</h3>
      <p className="text-3xl font-display font-bold text-foreground">{value}</p>
    </motion.div>
  );
};

export default MetricCard;
