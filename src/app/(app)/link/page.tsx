import { PageHeader } from '@/components/common/page-header'
import { Placeholder } from '@/components/common/placeholder'

export default function Page() {
  return (
    <>
      <PageHeader title="Link" subtitle="Reconcile your runs" />
      <Placeholder
        screen="Link"
        spec="docs/screens/08-link.md"
        features={[
            'Sync bar with Strava status and manual sync',
            'Needs review: auto-matcher suggestions to confirm or dismiss',
            'Unlinked runs, newest first',
            'Workouts waiting for an activity',
            'All-clear state when everything is reconciled',
        ]}
      />
    </>
  )
}
