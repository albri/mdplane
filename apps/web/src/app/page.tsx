import { redirect } from 'next/navigation'
import { CONTROL_FRONTEND_ROUTES } from '@mdplane/shared'

export default function Home() {
  redirect(CONTROL_FRONTEND_ROUTES.root)
}
