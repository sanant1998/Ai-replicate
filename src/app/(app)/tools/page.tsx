import { redirect } from 'next/navigation'
import { currentUser } from '@/lib/session'
import { ToolsWorkspace } from './ToolsWorkspace'

export default async function ToolsPage() {
  const user = await currentUser()

  // The tools themselves run entirely in the browser and cost nothing, but they
  // stay behind the same sign-in gate as the rest of the app shell. Redirect
  // rather than render a dead-end card, and come back here afterwards.
  if (!user) redirect('/login?next=%2Ftools')

  return <ToolsWorkspace />
}
