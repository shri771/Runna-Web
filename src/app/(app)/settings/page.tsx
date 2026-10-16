import { PageHeader } from '@/components/common/page-header'
import { Placeholder } from '@/components/common/placeholder'

export default function Page() {
  return (
    <>
      <PageHeader title="Settings" subtitle="Profile and connections" />
      <Placeholder
        screen="Settings"
        spec="docs/screens/07-settings.md"
        features={[
            'Profile, units, timezone, week start',
            'Ability and pace basis, with zone preview before applying',
            'Strava connect, sync, disconnect',
            'Automatic linking preferences',
            'Data export and account deletion',
        ]}
      />
    </>
  )
}
