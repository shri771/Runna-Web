import { PageHeader } from '@/components/common/page-header'
import { Placeholder } from '@/components/common/placeholder'

export default function Page() {
  return (
    <>
      <PageHeader title="Calendar" subtitle="Agenda" />
      <Placeholder
        screen="Calendar"
        spec="docs/screens/04-calendar.md"
        features={[
            'Infinite agenda grouped by week with weekly totals',
            'Workout chips with type colour bar and status badge',
            'Drag and drop to rearrange, with move validation',
            'Add an extra workout to any day',
            'Month grid toggle on desktop',
        ]}
      />
    </>
  )
}
