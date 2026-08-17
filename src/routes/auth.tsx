import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { z } from "zod";
import { toast } from "sonner";
import { Clapperboard, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — CineTogether" },
      { name: "description", content: "Sign in to CineTogether to host and join synchronized watch rooms." },
      { property: "og:title", content: "Sign in — CineTogether" },
      { property: "og:description", content: "Host or join a synchronized movie room with friends." },
    ],
  }),
  component: AuthPage,
});

const credentials = z.object({
  email: z.string().trim().email({ message: "Enter a valid email address" }).max(255),
  password: z.string().min(8, { message: "Password must be at least 8 characters" }).max(72),
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/rooms", replace: true });
      else setChecking(false);
    });
  }, [navigate]);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    const parsed = credentials.safeParse({ email, password });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    setLoading(false);
    if (error) {
      if (error.message?.toLowerCase().includes("invalid login credentials")) {
        return toast.error("Invalid email/password, or account doesn't exist yet on this database. Switch to 'Create account' to register!");
      }
      return toast.error(error.message);
    }
    navigate({ to: "/rooms" });
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    const parsed = credentials.safeParse({ email, password });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      ...parsed.data,
      options: {
        emailRedirectTo: window.location.origin,
        data: { display_name: displayName.trim() || parsed.data.email.split("@")[0] },
      },
    });

    if (error) {
      // Attempt direct sign-in in case the user account was already created in a prior attempt
      const signInRes = await supabase.auth.signInWithPassword(parsed.data);
      setLoading(false);
      if (!signInRes.error && signInRes.data.session) {
        toast.success("Signed in successfully!");
        return navigate({ to: "/rooms" });
      }

      if (error.status === 429 || error.message?.toLowerCase().includes("rate limit") || error.message?.toLowerCase().includes("too many requests")) {
        return toast.error("Supabase Email Rate Limit (429). Please disable 'Confirm email' in your Supabase Auth dashboard.");
      }
      return toast.error(error.message);
    }

    if (!data.session) {
      // Try signing in immediately if email confirmation is off or auto-login is possible
      const signInRes = await supabase.auth.signInWithPassword(parsed.data);
      setLoading(false);
      if (!signInRes.error && signInRes.data.session) {
        return navigate({ to: "/rooms" });
      }
      setAwaitingConfirm(true);
      return;
    }
    setLoading(false);
    navigate({ to: "/rooms" });
  }

  async function handleGoogle() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/rooms`,
      },
    });

    if (error) {
      console.warn("Supabase native Google OAuth error, trying Lovable Auth:", error);
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        setLoading(false);
        return toast.error("Google sign-in failed. Please ensure Google Provider is enabled in your Supabase Auth dashboard.");
      }
      if (result.redirected) return;
      navigate({ to: "/rooms" });
    }
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-16">
      <Link to="/" className="mb-8 flex items-center gap-2">
        <Clapperboard className="size-7 text-primary" />
        <span className="font-display text-3xl tracking-widest text-gradient">CINETOGETHER</span>
      </Link>

      <div className="surface-panel w-full max-w-md rounded-2xl p-8">
        {awaitingConfirm ? (
          <div className="space-y-3 text-center">
            <h1 className="text-3xl">Check your inbox</h1>
            <p className="text-sm text-muted-foreground">
              We sent a confirmation link to {email}. Click it to activate your account, then come
              back and sign in.
            </p>
            <Button variant="outline" className="w-full" onClick={() => setAwaitingConfirm(false)}>
              Back to sign in
            </Button>
          </div>
        ) : (
          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="mt-6">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="size-4 animate-spin" /> : "Sign in"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-6">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Display name</Label>
                  <Input
                    id="name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    maxLength={40}
                    placeholder="How friends see you"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="size-4 animate-spin" /> : "Create account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        )}

        {!awaitingConfirm && (
          <>
            <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground uppercase">
              <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
            </div>
            <Button variant="outline" className="w-full" onClick={() => void handleGoogle()} disabled={loading}>
              Continue with Google
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
