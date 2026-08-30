# Settings sidebar tabs + account deletion design

## Overview
The settings experience will move from a long scrolling page into a sidebar-tab layout. The left rail contains a local search box and tabs for General, Account, Finance Bot, and Notifications. The right panel renders only the active tab.

## Frontend design
- Maintain a local `settingsTab` state and a `settingsSearch` string scoped to the settings page only.
- Filter tabs by tab label or keyword matches, and visually highlight the matching tabs in the left rail.
- Preserve the existing preference logic for theme, language, finance bot, and notifications;
  only reorganize the view and add the destructive-account flow in the Account tab.
- The Account tab shows the current name/email and links to the existing profile page for editing. It also includes a logout-from-all-devices action and a dangerous-zone confirmation dialog for account deletion.

## Backend design
- The current implementation uses a soft-delete pattern (`deleted_at`) and is not a true permanent wipe.
- The new delete-account flow validates the current password and email confirmation before executing a hard delete.
- Deletion is implemented in a transaction that removes the user’s owned records and then removes the user row itself.
- Prisma FKs for all tables referencing `user_id` will use `onDelete: Cascade` so the database does not leave orphaned rows or fail on FK constraints during account deletion.

## Security requirements
- User identity is always taken from the JWT (`@CurrentUser('sub')`), never from a client-supplied ID.
- The final deletion request requires both the account email confirmation and the current password to minimize accidental or malicious deletion.
- After a successful hard delete, the client clears local auth state and redirects to `/login` immediately.
- Only a single authenticated user can delete their own account; no admin override is provided.

## Acceptance criteria
- Sidebar tabs render with local search filtering and highlight states.
- The General tab keeps theme and language preference controls.
- The Account tab includes profile summary, logout-all-devices, and destructive delete flow.
- Finance Bot and Notification settings stay in their dedicated tabs.
- The backend rejects delete-account requests without matching email or password verification.
- A successful delete request removes the user and all related data before the session is ended and the client logs out.
