// Home Assistant REST API client — server-side only, never imported client-side

export interface HaRawState {
  entity_id: string
  state: string
  attributes: Record<string, unknown>
  last_updated: string
  last_changed: string
}

export interface VacuumAttributes {
  battery_level?: number
  status?: string
  fan_speed?: string
  fan_speed_list?: string[]
  supported_features?: number
  error?: string
  friendly_name?: string
}

export interface VacuumStatus {
  state: string
  attributes: VacuumAttributes
  lastUpdated: string
  supportedFeatures: {
    pause: boolean
    returnHome: boolean
    battery: boolean
    locate: boolean
    fanSpeed: boolean
  }
}

// Home Assistant VacuumEntityFeature bitmask values
const Feature = {
  PAUSE: 4,
  RETURN_HOME: 16,
  BATTERY: 64,
  LOCATE: 512,
  FAN_SPEED: 32,
} as const

function hasFeature(mask: number | undefined, bit: number): boolean {
  return mask !== undefined && (mask & bit) !== 0
}

function getConfig(): { url: string; token: string } {
  const url = process.env.HOME_ASSISTANT_URL?.replace(/\/$/, '')
  const token = process.env.HOME_ASSISTANT_TOKEN
  if (!url) throw new Error('HOME_ASSISTANT_URL is not configured')
  if (!token) throw new Error('HOME_ASSISTANT_TOKEN is not configured')
  return { url, token }
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

async function haFetch(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { ...init, cache: 'no-store' })
  } catch {
    throw new Error('Home Assistant is unreachable — check HOME_ASSISTANT_URL')
  }
}

async function getState(entityId: string): Promise<HaRawState> {
  const { url, token } = getConfig()
  const res = await haFetch(`${url}/api/states/${entityId}`, {
    headers: authHeaders(token),
  })
  if (res.status === 401) throw new Error('Invalid Home Assistant token')
  if (res.status === 404) throw new Error(`Entity "${entityId}" not found in Home Assistant`)
  if (!res.ok) throw new Error(`Home Assistant returned HTTP ${res.status}`)
  return res.json()
}

async function callService(domain: string, service: string, entityId: string): Promise<void> {
  const { url, token } = getConfig()
  const res = await haFetch(`${url}/api/services/${domain}/${service}`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ entity_id: entityId }),
  })
  if (res.status === 401) throw new Error('Invalid Home Assistant token')
  if (!res.ok) throw new Error(`Home Assistant returned HTTP ${res.status}`)
}

function parseVacuumStatus(raw: HaRawState): VacuumStatus {
  const attrs = raw.attributes as VacuumAttributes
  const mask = attrs.supported_features
  return {
    state: raw.state,
    attributes: attrs,
    lastUpdated: raw.last_updated,
    supportedFeatures: {
      pause: hasFeature(mask, Feature.PAUSE),
      returnHome: hasFeature(mask, Feature.RETURN_HOME),
      battery: hasFeature(mask, Feature.BATTERY),
      locate: hasFeature(mask, Feature.LOCATE),
      fanSpeed: hasFeature(mask, Feature.FAN_SPEED),
    },
  }
}

export async function getVacuumStatus(entityId: string): Promise<VacuumStatus> {
  return parseVacuumStatus(await getState(entityId))
}

export async function vacuumAction(
  entityId: string,
  action: 'start' | 'pause' | 'return_to_base'
): Promise<VacuumStatus> {
  await callService('vacuum', action, entityId)
  // Brief wait for HA to process the command before re-fetching state
  await new Promise((r) => setTimeout(r, 1200))
  return parseVacuumStatus(await getState(entityId))
}
