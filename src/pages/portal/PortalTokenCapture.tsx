import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

const STORAGE_KEY = "pilar-portal-token";

interface Props {
  subpath?: string;
}

export default function PortalTokenCapture({ subpath = "" }: Props) {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) return;
    sessionStorage.setItem(STORAGE_KEY, token);
    navigate(`/portal${subpath}`, { replace: true });
  }, [token, navigate, subpath]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}
