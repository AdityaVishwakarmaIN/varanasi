import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { FEATURES } from '@/lib/features';

interface Props {
  params: Promise<{ roomCode: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { roomCode } = await params;
  const code = roomCode.toUpperCase();
  
  const title = `Join co-op ${code}`;
  const fullTitle = `Varanasi — ${title}`;
  const description = `You've been invited to build a city together! Join room ${code} to start playing.`;

  return {
    title,
    description,
    openGraph: {
      title: fullTitle,
      description,
      siteName: 'Varanasi',
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
    },
  };
}

export default function CoopRoomLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Co-op is hidden for v1: send old invite links to the home page.
  if (!FEATURES.coop) redirect('/');
  return children;
}
