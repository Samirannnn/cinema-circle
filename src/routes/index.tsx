import { createFileRoute, Link } from "@tanstack/react-router";
import { MessagesSquare, MonitorPlay, Users, Video, Wand2, Lock } from "lucide-react";
import heroImage from "@/assets/hero.jpg";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Landing,
});

const features = [
  {
    icon: MonitorPlay,
    title: "Frame-perfect sync",
    body: "Play, pause, seek and speed changes propagate to everyone in the room instantly.",
  },
  {
    icon: Video,
    title: "Faces in the dark",
    body: "Optional peer-to-peer webcam and mic, with a grid that reflows as people come and go.",
  },
  {
    icon: MessagesSquare,
    title: "Live reactions",
    body: "Timestamped chat, emoji reactions and raise-hand — without pausing the film.",
  },
  {
    icon: Lock,
    title: "Private rooms",
    body: "Share a six-character code or an invite link. Public rooms are discoverable, private ones aren't.",
  },
  {
    icon: Users,
    title: "Host controls",
    body: "The host drives playback and can hand the remote to anyone in the room.",
  },
  {
    icon: Wand2,
    title: "Bring your own movie",
    body: "Paste an MP4 or HLS link, or upload a file straight into the room.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main>
        <section className="relative isolate overflow-hidden">
          <img
            src={heroImage}
            alt="Friends watching a film together in a darkened room"
            width={1920}
            height={1088}
            className="absolute inset-0 size-full object-cover opacity-70"
          />
          <div
            className="absolute inset-0"
            style={{ backgroundImage: "var(--gradient-hero)" }}
            aria-hidden="true"
          />
          <div className="relative mx-auto flex min-h-[78vh] max-w-5xl flex-col items-center justify-center px-4 py-24 text-center">
            <span className="mb-6 rounded-full border border-border/70 bg-background/50 px-4 py-1.5 text-xs font-semibold tracking-[0.25em] text-muted-foreground uppercase backdrop-blur">
              Movie night, wherever you are
            </span>
            <h1 className="max-w-4xl text-6xl leading-[0.95] sm:text-8xl">
              Watch together.
              <br />
              <span className="text-gradient">Never out of sync.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
              CineTogether keeps everyone on the exact same frame, and puts your friends' faces and
              voices right next to the screen.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="glow px-8 text-base">
                <Link to="/rooms">Start a watch party</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="px-8 text-base">
                <Link to="/auth">Join with a code</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
          <h2 className="text-4xl sm:text-5xl">Everything a shared screening needs</h2>
          <p className="mt-3 max-w-xl text-muted-foreground">
            Built for long-distance movie nights, watch-along premieres and film club evenings.
          </p>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <article key={feature.title} className="surface-panel hover-lift rounded-2xl p-6">
                <feature.icon className="size-6 text-accent" />
                <h3 className="mt-4 text-2xl">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{feature.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-28 sm:px-6">
          <div className="surface-panel flex flex-col items-center gap-6 rounded-3xl px-8 py-16 text-center">
            <h2 className="text-4xl sm:text-5xl">Dim the lights.</h2>
            <p className="max-w-lg text-muted-foreground">
              Create a room in seconds, send the link, and press play together.
            </p>
            <Button asChild size="lg" className="glow px-10">
              <Link to="/rooms">Create a room</Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60 py-8 text-center text-sm text-muted-foreground">
        CineTogether — synchronized movie nights.
      </footer>
    </div>
  );
}
