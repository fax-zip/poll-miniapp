"use client";

import dynamic from "next/dynamic";
import { use } from "react";

const PollApp = dynamic(() => import("@/components/PollApp"), { ssr: false });

export default function PollPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <PollApp initialPollId={id} />;
}
