/** A city cameras are classified by. A row in `VmsCities`, never a hard-coded list. */
export interface VmsCity {
  code: string;
  name: string;
  displayOrder: number;
  isActive: boolean;
  cameraCount: number;
}

export interface CameraListItem {
  id: number;
  name: string;
  cityCode: string;
  cityName: string;
  host: string;
  rtspPort: number;
  /** The go2rtc stream name. This is what the player asks the gateway for. */
  streamKey: string;
  channel: number;
  subStreamId: number;
  /**
   * Null on every site measured so far, and that is a fact rather than a gap: the main stream needs
   * ~11.2 Mbit/s against a site uplink of ~0.41, so it cannot be watched at all.
   */
  mainStreamId: number | null;
  isActive: boolean;
  /** Written by the scheduled sweep. Null means never checked — not the same as offline. */
  lastSeenUtc: string | null;
}

export interface CameraDetail extends CameraListItem {
  /** Names a credential held on the media VPS. Never a password — none is stored. */
  credentialKey: string;
  notes: string | null;
}

/** The body of a create or an update. `streamKey` is absent: the server generates it, once. */
export interface CameraInput {
  name: string;
  cityCode: string;
  host: string;
  rtspPort: number;
  credentialKey: string;
  channel: number;
  subStreamId: number;
  mainStreamId: number | null;
  isActive: boolean;
  notes: string | null;
}

export interface MediaSession {
  expiresAtUtc: string;
  ttlSeconds: number;
}

/**
 * How many tiles one page of the wall shows.
 *
 * Nine, and it is a bandwidth decision rather than a layout one. Every tile is a live pull from a
 * different site, and a tile that is on screen is a camera that is being watched. Paging is what
 * stops twenty cameras being opened because somebody scrolled past them.
 */
export const WALL_PAGE_SIZE = 9;
