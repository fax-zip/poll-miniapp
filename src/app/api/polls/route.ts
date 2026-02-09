import { NextRequest, NextResponse } from "next/server";

export interface Poll {
  id: string;
  title: string;
  options: { text: string; votes: number }[];
  voters: Set<string>; // set of visitorIds who have voted (no record of what they picked)
  createdAt: number;
}

const polls = new Map<string, Poll>();

// Strip voters from response — votes are anonymous
function sanitize(poll: Poll) {
  return {
    id: poll.id,
    title: poll.title,
    options: poll.options,
    totalVoters: poll.voters.size,
    createdAt: poll.createdAt,
  };
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const visitorId = req.nextUrl.searchParams.get("visitorId");

  if (id) {
    const poll = polls.get(id);
    if (!poll) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({
      ...sanitize(poll),
      hasVoted: visitorId ? poll.voters.has(visitorId) : false,
    });
  }

  const list = Array.from(polls.values())
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((poll) => ({
      ...sanitize(poll),
      hasVoted: visitorId ? poll.voters.has(visitorId) : false,
    }));

  return NextResponse.json(list);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { title, options } = body as { title: string; options: string[] };

  if (!title?.trim() || !options || options.length < 2) {
    return NextResponse.json({ error: "Title and at least 2 options required" }, { status: 400 });
  }

  const id = Math.random().toString(36).substring(2, 10);
  const poll: Poll = {
    id,
    title: title.trim(),
    options: options.filter((o: string) => o.trim()).map((o: string) => ({ text: o.trim(), votes: 0 })),
    voters: new Set(),
    createdAt: Date.now(),
  };

  polls.set(id, poll);
  return NextResponse.json({ ...sanitize(poll), hasVoted: false });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { pollId, optionIndex, visitorId } = body as {
    pollId: string;
    optionIndex: number;
    visitorId: string;
  };

  const poll = polls.get(pollId);
  if (!poll) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (optionIndex < 0 || optionIndex >= poll.options.length) {
    return NextResponse.json({ error: "Invalid option" }, { status: 400 });
  }

  // Block re-votes — once you vote, it's final
  if (poll.voters.has(visitorId)) {
    return NextResponse.json({ error: "You have already voted" }, { status: 403 });
  }

  poll.options[optionIndex].votes++;
  poll.voters.add(visitorId);

  return NextResponse.json({ ...sanitize(poll), hasVoted: true });
}
