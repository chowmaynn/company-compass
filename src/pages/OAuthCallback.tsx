import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { exchangeCode } from "@/lib/youtube-auth";

export default function OAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get("code");
    const errorParam = searchParams.get("error");

    if (errorParam) {
      setError(`Authorization denied: ${errorParam}`);
      return;
    }

    if (!code) {
      setError("No authorization code received");
      return;
    }

    exchangeCode(code)
      .then(() => navigate("/", { replace: true }))
      .catch((err) => setError(err.message));
  }, [searchParams, navigate]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="max-w-md rounded-lg border border-destructive/50 bg-card p-6 text-center">
          <h2 className="mb-2 text-lg font-semibold text-destructive">Authorization Failed</h2>
          <p className="mb-4 text-sm text-muted-foreground">{error}</p>
          <button
            onClick={() => navigate("/", { replace: true })}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <p className="text-muted-foreground">Completing authorization…</p>
    </div>
  );
}
