import { ProfileSettingsForm } from "@/features/profile/components/profile-settings-form";

export default function Page() {
  return (
    <>
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Profile Settings</h1>
        <p className="mt-2 text-muted-foreground">Update the sender name and contact details used for your parcels.</p>
      </div>
      <ProfileSettingsForm />
    </>
  );
}
