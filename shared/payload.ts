export type WebhookPayload = {
  'Provider_shoko episode': string;
  EpisodeNumber: number;
  SeasonNumber: number;
  NotificationType: string;
  SaveReason: string;
  PlaybackPositionTicks: number;
  RunTimeTicks: number;
  NotificationUsername: string;
};
