import { PageHeader } from '@/components/common/page-header'
import { Placeholder } from '@/components/common/placeholder'

export default function Page() {
  return (
    <>
      <PageHeader title="Your Plan" subtitle="Half Marathon Plan" />
      <Placeholder
        screen="Your Plan"
        spec="docs/screens/03-plan.md"
        features={[
            'Hero: plan name, race date, distance badge',
            'Quick actions: Plan Guide, Rearrange, Connected Apps, Manage Plan',
            'Plan overview chart, one bar per week, cutbacks and taper visible',
            'Stat rows: week completion, plan distance, adherence',
            'Manage Plan with diff preview before regenerating',
        ]}
      />
    </>
  )
}
