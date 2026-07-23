// Q5 flight animation and playback controls.
import {
  JulianDate,
  ClockRange,
  ClockStep,
  type Viewer,
  type Entity,
  type CzmlDataSource,
} from 'cesium';
import { layerManager } from '../../cesium/LayerManager';
import { LOCAL } from '../../config';

const DEFAULT_SPEED = 1;

class FlightController {
  private viewer: Viewer | null = null;
  private ds: CzmlDataSource | null = null;
  private drone: Entity | null = null;
  private loaded = false;

  async load() {
    if (this.loaded) return;
    this.loaded = true;
    this.viewer = layerManager.cesium;
    const ds = await layerManager.addCzml({
      id: 'flight_czml',
      name: '无人机飞行动画',
      group: '无人机',
      url: LOCAL.flightCzml,
      visible: true,
    });
    if (!ds) return;
    this.ds = ds;
    this.drone = ds.entities.getById('drone') ?? null;

    // Start paused at the flight interval.
    const clock = this.viewer.clock;
    if (this.drone?.availability) {
      const start = this.drone.availability.start;
      const stop = this.drone.availability.stop;
      clock.startTime = start.clone();
      clock.stopTime = stop.clone();
      clock.currentTime = start.clone();
      clock.clockRange = ClockRange.LOOP_STOP;
      clock.clockStep = ClockStep.SYSTEM_CLOCK_MULTIPLIER;
      clock.multiplier = DEFAULT_SPEED;
      clock.shouldAnimate = false;
      this.viewer.timeline?.zoomTo(start, stop);
    }
  }

  play() {
    if (this.viewer) this.viewer.clock.shouldAnimate = true;
  }
  pause() {
    if (this.viewer) this.viewer.clock.shouldAnimate = false;
  }
  toggle(): boolean {
    if (!this.viewer) return false;
    this.viewer.clock.shouldAnimate = !this.viewer.clock.shouldAnimate;
    return this.viewer.clock.shouldAnimate;
  }
  reset() {
    if (this.viewer && this.drone?.availability) {
      this.viewer.clock.currentTime = this.drone.availability.start.clone();
    }
  }
  setSpeed(mult: number) {
    if (this.viewer) this.viewer.clock.multiplier = mult;
  }
  getSpeed(): number {
    return this.viewer?.clock.multiplier ?? DEFAULT_SPEED;
  }
  /** Follow the drone. */
  follow(on: boolean) {
    if (this.viewer) this.viewer.trackedEntity = on ? this.drone ?? undefined : undefined;
  }
  /** Fly to the whole route. */
  async frame() {
    if (this.viewer && this.ds) await this.viewer.flyTo(this.ds);
  }
  isPlaying(): boolean {
    return !!this.viewer?.clock.shouldAnimate;
  }
  formatTime(): string {
    if (!this.viewer) return '';
    return JulianDate.toIso8601(this.viewer.clock.currentTime, 0).replace('T', ' ').replace('Z', '');
  }
}

export const flightController = new FlightController();
