# Profile Avatar

## Requirements

- Show the Google or GitHub profile photo returned by the provider for the signed-in user.
- Refresh the stored avatar from the provider on each OAuth login, including clearing it when the provider has no photo.
- Show the user's initials when no provider photo is available.
- Do not offer profile-photo upload or replacement controls.
- Keep the mobile bottom navigation anchored to the viewport after refresh.

## Design Read

Reading this as: profile identity and mobile navigation in the existing Neraca finance dashboard, using its established interface, dial ENERGY 1 / RHYTHM 1 / MOTION 1.

## Implementation

- Carry `avatar_url` through OAuth login, auth hydration, `/auth/me`, and the shared auth store.
- Render provider photos in the existing header avatar, with initials as the fallback.
- Synchronize linked Google and GitHub accounts with the current provider photo during OAuth callback handling.
- Keep the mobile navigation fixed to the viewport and cover it with responsive regression tests.

## Decision Reasons

- Provider-owned profile URLs keep identity photos synchronized without introducing user-uploaded assets or image-storage infrastructure.
- Initials provide a clear, stable fallback for accounts whose provider has no photo.
- The existing avatar component and theme tokens preserve the dashboard's established visual language.
- A fixed mobile navigation bar remains reachable when the mobile viewport changes during refresh.
