# Notification Time Preferences Implementation Guide

## Overview

This document describes how the backend notification system should be updated to respect user-configured notification time preferences.

## Database Schema

The following fields have been added to the `notification_preferences` table:

- `notification_hours`: INTEGER[] - Array of hours (0-23) when notifications should be sent
- `respect_notification_hours`: BOOLEAN - Whether to respect the selected notification hours

## Backend Implementation Requirements

### 1. Notification Queue System

When jobs are scraped and found, instead of immediately sending notifications:

1. **Check User Preferences**: Query the user's `notification_preferences` to get their `notification_hours` and `respect_notification_hours` settings.

2. **Current Hour Check**: Get the current hour in the user's timezone (you may need to add timezone preference).

3. **Queuing Logic**:
   ```sql
   -- Example query to check if notifications should be sent now
   SELECT np.notification_hours, np.respect_notification_hours
   FROM notification_preferences np
   WHERE np.user_id = $1;
   
   -- Check if current hour is in allowed hours
   -- If respect_notification_hours = false OR current_hour = ANY(notification_hours)
   -- Then send immediately, otherwise queue for later
   ```

### 2. Notification Scheduling

**Option A: Cron-based approach**
- Run a cron job every hour
- Check for queued notifications where the current hour matches user preferences
- Send notifications for users who have the current hour in their `notification_hours` array

**Option B: Database trigger approach**
- Use database scheduling (like PostgreSQL's pg_cron extension)
- Schedule notifications to be sent at the next allowed hour

### 3. Queued Notifications Table

Create a new table to store queued notifications:

```sql
CREATE TABLE queued_notifications (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  notification_type TEXT NOT NULL,
  job_ids INTEGER[] NOT NULL,
  query_ids INTEGER[] NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  scheduled_for_hour INTEGER NOT NULL, -- Next allowed hour to send
  content JSONB NOT NULL -- Email/webhook content
);
```

### 4. Updated Notification Flow

```
1. Jobs scraped and found for user
2. Check user's notification preferences
3. If respect_notification_hours = false:
   - Send immediately (current behavior)
4. If respect_notification_hours = true:
   - Check if current hour is in notification_hours array
   - If yes: send immediately
   - If no: queue for next allowed hour
5. Hourly cron job processes queued notifications
```

### 5. Implementation Example (Pseudocode)

```javascript
async function handleNewJobsFound(userId, newJobs) {
  const preferences = await getNotificationPreferences(userId);
  
  if (!preferences.respect_notification_hours) {
    // Send immediately (existing behavior)
    await sendJobNotification(userId, newJobs);
    return;
  }
  
  const currentHour = new Date().getHours(); // Consider timezone
  const allowedHours = preferences.notification_hours || [];
  
  if (allowedHours.includes(currentHour)) {
    // Send immediately
    await sendJobNotification(userId, newJobs);
  } else {
    // Queue for later
    const nextAllowedHour = findNextAllowedHour(currentHour, allowedHours);
    await queueNotification(userId, newJobs, nextAllowedHour);
  }
}

function findNextAllowedHour(currentHour, allowedHours) {
  // Find the next hour in allowedHours after currentHour
  // If no hour today, return first hour tomorrow
  const sortedHours = allowedHours.sort((a, b) => a - b);
  
  for (const hour of sortedHours) {
    if (hour > currentHour) {
      return hour;
    }
  }
  
  // No more hours today, return first hour tomorrow
  return sortedHours[0];
}

// Cron job function (runs every hour)
async function processQueuedNotifications() {
  const currentHour = new Date().getHours();
  
  const queuedNotifications = await getQueuedNotificationsForHour(currentHour);
  
  for (const notification of queuedNotifications) {
    await sendQueuedNotification(notification);
    await markNotificationAsSent(notification.id);
  }
}
```

### 6. User Experience Considerations

- When jobs are queued, show a subtle indicator in the UI that notifications are pending
- Allow users to see their notification queue/schedule
- Provide clear messaging about when notifications will be sent
- Consider adding an override option for urgent notifications

### 7. Edge Cases to Handle

- **No allowed hours**: If user selects no hours, disable notifications or show warning
- **Timezone changes**: Handle user timezone changes gracefully
- **Multiple jobs in short time**: Batch notifications to avoid spam
- **User preference changes**: Update queued notifications when preferences change

### 8. Monitoring and Logging

- Log when notifications are queued vs sent immediately
- Track notification delivery success/failure rates
- Monitor queue size and processing times
- Alert if notifications are significantly delayed

## Frontend Integration

The frontend already includes:
- ✅ UI for selecting notification hours
- ✅ Database schema updates
- ✅ TypeScript interfaces
- ✅ User preference management

## Testing Checklist

- [ ] Notifications sent immediately when respect_notification_hours = false
- [ ] Notifications queued when current hour not in allowed hours
- [ ] Notifications sent when hourly job runs during allowed hours
- [ ] Edge case: no allowed hours selected
- [ ] Edge case: user changes preferences while notifications queued
- [ ] Performance testing with large numbers of queued notifications
- [ ] Timezone handling verification

## Migration Notes

When deploying this feature:
1. Run the database migration to add new columns
2. Set default values for existing users (9-17 business hours)
3. Deploy backend notification logic updates
4. Monitor notification delivery during rollout