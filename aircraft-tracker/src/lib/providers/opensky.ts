import type { AircraftProvider, AircraftFeed } from './types'

// OpenSky Network provider stub — implement when needed.
// Docs: https://openskynetwork.github.io/opensky-api/
export class OpenSkyProvider implements AircraftProvider {
  readonly name = 'opensky'

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async fetchNearby(_lat: number, _lon: number, _radiusNm: number): Promise<AircraftFeed> {
    throw new Error('OpenSky provider not yet implemented')
  }
}
