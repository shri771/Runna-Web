import { PageHeader } from '@/components/common/page-header'
import { Placeholder } from '@/components/common/placeholder'

export default function Page() {
  return (
    <>
      <PageHeader title="Progress" subtitle="Performance" />
      <Placeholder
        screen="Progress"
        spec="docs/screens/06-progress.md"
        features={[
            'Workouts and Performance tabs',
            'Distance, time and activity totals by week, month or year',
            'Rolling bar chart with actual vs planned overlay',
            'Personal records grid, 13 distances, locked until achieved',
            'Compliance breakdown and plan adherence',
        ]}
      />
    </>
  )
}
