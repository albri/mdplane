import { redirect } from 'next/navigation';
import { DEMO_READ_KEY } from '@mdplane/shared';

export default function DemoPage() {
  redirect(`/r/${DEMO_READ_KEY}`);
}

