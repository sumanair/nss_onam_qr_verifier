export type Payload = Record<string, unknown>;
export type ScanResultLike = string | { data?: string };

export type Summary = {
  username: string;
  email: string;
  number_of_attendees: number;
  number_checked_in: number;
  remaining: number;
  all_attendees_checked_in: boolean;
};

export type CheckinResp = {
  message: string;
  checked_in: number;
  remaining: number;
};
