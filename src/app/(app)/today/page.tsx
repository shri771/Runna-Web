import { PageHeader } from '@/components/common/page-header'
import { Placeholder } from '@/components/common/placeholder'

export default function Page() {
  return (
    <>
      <PageHeader title="Today" subtitle="Week 2 of 12" />
      <Placeholder
        screen="Today"
        spec="docs/screens/02-today.md"
        features={[
            'Week strip with per-day workout type dots',
            "Today's workout card with completion toggle",
            'Week overview: segmented progress, workouts and distance',
            'Insight cards: mileage on track, pace drift, consistency',
            'Link a run pill',
        ]}
      />
    </>
  )
}
