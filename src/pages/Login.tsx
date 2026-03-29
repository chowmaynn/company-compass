import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";
import { Compass, Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";

export default function Login() {
  const { user, loading: authLoading, signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (user) return <Navigate to="/" replace />;

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const err = await signIn(email, password);
    if (err) setError(err);
    setLoading(false);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { setError("Enter your email address"); return; }
    setError(null);
    setLoading(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset`,
    });
    if (err) setError(err.message);
    else setResetSent(true);
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Branding */}
        <div className="flex flex-col items-center gap-3">
          <div className="rounded-2xl bg-primary p-3">
            <Compass className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Company Compass</h1>
          <p className="text-sm text-muted-foreground">
            {forgotMode ? "Reset your password" : "Sign in to your dashboard"}
          </p>
        </div>

        {/* Forgot password — sent confirmation */}
        {forgotMode && resetSent ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <CheckCircle2 className="h-10 w-10 text-status-green" />
            <p className="text-sm text-foreground font-medium">Check your email</p>
            <p className="text-xs text-muted-foreground">
              We sent a password reset link to <span className="font-medium text-foreground">{email}</span>
            </p>
            <button
              onClick={() => { setForgotMode(false); setResetSent(false); setError(null); }}
              className="text-sm text-primary hover:text-primary/80 font-medium mt-2 flex items-center gap-1"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to sign in
            </button>
          </div>
        ) : forgotMode ? (
          /* Forgot password — email form */
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                className="w-full rounded-xl bg-card border border-white/10 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="you@company.com"
              />
            </div>

            {error && <p className="text-sm text-status-red">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Send Reset Link
            </button>

            <button
              type="button"
              onClick={() => { setForgotMode(false); setError(null); }}
              className="w-full text-sm text-muted-foreground hover:text-foreground flex items-center justify-center gap-1"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to sign in
            </button>
          </form>
        ) : (
          /* Sign in form */
          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                className="w-full rounded-xl bg-card border border-white/10 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="you@company.com"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="block text-sm font-medium text-foreground">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => { setForgotMode(true); setError(null); }}
                  className="text-xs text-primary hover:text-primary/80 font-medium"
                >
                  Forgot password?
                </button>
              </div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-xl bg-card border border-white/10 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="Enter your password"
              />
            </div>

            {error && <p className="text-sm text-status-red">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Sign In
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
