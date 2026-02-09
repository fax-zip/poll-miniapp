"use client";

import dynamic from "next/dynamic";

const PollApp = dynamic(() => import("@/components/PollApp"), { ssr: false });

export default function Home() {
  return <PollApp />;
}
