import type { Metadata } from "next";
import LandingPage from "@/components/LandingPage";

export const metadata: Metadata = {
  title: { absolute: "Our Troop Manager: troop sign-ups, payments, forms and advancement" },
  description: "One place for Scouts BSA troops: event sign-up and payment, health form status, advancement with Scoutbook upload tracking, and messages logged for youth protection. $125 a year per troop.",
  openGraph: {
    title: "Our Troop Manager: less paperwork, more Scouting",
    description: "Sign-ups, payments, forms, advancement and messages for your troop, built around youth protection. First 30 days free.",
    type: "website",
  },
};

// Landing page renders publicly — no auth needed.
export default function Home() {
  return <LandingPage />;
}
