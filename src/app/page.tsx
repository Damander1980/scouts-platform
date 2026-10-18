import LandingPage from "@/components/LandingPage";

// Landing page renders publicly — no auth needed.
// Logged-in users get redirected by middleware when they hit /dashboard directly.
export default function Home() {
  return <LandingPage />;
}
