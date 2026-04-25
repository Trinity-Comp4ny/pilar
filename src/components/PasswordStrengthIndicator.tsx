import { evaluatePassword } from "@/lib/passwordPolicy";

const SCORE_COLOR = ["bg-red-500", "bg-red-400", "bg-amber-400", "bg-emerald-400", "bg-emerald-500"];

export function PasswordStrengthIndicator({ password }: { password: string }) {
  const { score, label, feedback } = evaluatePassword(password);

  return (
    <div className="space-y-1.5">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${i < score ? SCORE_COLOR[score] : "bg-slate-200"}`}
          />
        ))}
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500 capitalize">{label}</span>
        {feedback.length > 0 && <span className="text-amber-600">{feedback[0]}</span>}
      </div>
    </div>
  );
}
