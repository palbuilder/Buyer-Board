import { getNotificationBellState } from "@/lib/notifications";
import { NotificationBellClient } from "./notification-bell-client";

export async function NotificationBell() {
  const bellState = await getNotificationBellState(12);

  return (
    <NotificationBellClient
      initialIsSignedIn={bellState.isSignedIn}
      initialNotifications={bellState.notifications}
      initialUnreadCount={bellState.unreadCount}
    />
  );
}
