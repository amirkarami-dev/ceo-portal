/**
 * At most one live connection per camera, per tab.
 *
 * <p><b>Why this exists.</b> A camera site uploads about 0.41 Mbit/s and its substream needs about
 * 0.35, so there is room for exactly one puller. The gateway protects the camera itself — go2rtc
 * holds one RTSP session and fans it out — but nothing stops <i>this app</i> opening the same stream
 * twice, and every duplicate is bandwidth spent twice for one picture.</p>
 *
 * <p>It happens for ordinary reasons: a tile is on screen and somebody expands it, so the tile and
 * the modal both want the same camera for as long as the modal is open. React's StrictMode mounts
 * every effect twice in development, which is the same shape of problem arriving a millisecond
 * apart.</p>
 *
 * <p><b>Last acquire wins.</b> Refusing the newcomer would be the obvious rule and it is the wrong
 * one: during a modal transition the new player mounts before the old one unmounts, so "first wins"
 * leaves the screen the user is looking at black while an invisible tile holds the lease. Preempting
 * is also what makes StrictMode's double mount harmless.</p>
 */
type Stop = () => void;

const owners = new Map<string, { token: object; stop: Stop }>();

export interface Lease {
  /** Give the stream up. A no-op if something else has already taken it. */
  release(): void;
}

export function acquireStream(streamKey: string, stop: Stop): Lease {
  const token = {};

  const previous = owners.get(streamKey);
  owners.set(streamKey, { token, stop });

  // After the map is updated, so a stop() that synchronously releases cannot delete the new owner.
  previous?.stop();

  return {
    release() {
      if (owners.get(streamKey)?.token === token) {
        owners.delete(streamKey);
      }
    },
  };
}

/** How many cameras this tab is holding open. Exposed for tests and for a diagnostic. */
export function heldStreamCount(): number {
  return owners.size;
}

/** Test seam. Never call this from the app. */
export function resetStreamLeases(): void {
  owners.clear();
}
