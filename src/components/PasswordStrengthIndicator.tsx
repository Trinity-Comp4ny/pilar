import { evaluatePassword } from "@/lib/passwordPolicy";

const SCORE_COLOR = ["bg-fill-danger", "bg-fill-danger", "bg-fill-warning", "bg-positive", "bg-positive"];

export function PasswordStrengthIndicator({ password }: { password: string }) {
  const { score, label, feedback } = evaluatePassword(password);

  return (
    <div className="space-y-1.5">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${i < score ? SCORE_COLOR[score] : "bg-muted"}`}
          />
        ))}
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-ink-muted capitalize">{label}</span>
        {feedback.length > 0 && <span className="text-warning-mid">{feedback[0]}</span>}
      </div>
    </div>
  );
}
