export type NtfyMessage = {
  title: string;
  message: string;
  priority: number;
  tags?: string[];
  click?: string;
};
