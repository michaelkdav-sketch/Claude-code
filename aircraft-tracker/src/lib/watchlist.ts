export interface WatchlistEntry {
  prefix: string
  name: string
  scoreBonus: number
}

// Known NAS North Island, MCAS Miramar, and broader San Diego military callsign prefixes
export const WATCHLIST_ENTRIES: WatchlistEntry[] = [
  // Carrier Air Wing / Carrier-based squadrons (NAS North Island)
  { prefix: 'VAW', name: 'Carrier AEW Squadron (E-2 Hawkeye)', scoreBonus: 25 },
  { prefix: 'VAQ', name: 'Carrier Electronic Attack (EA-18G)', scoreBonus: 25 },
  { prefix: 'VFA', name: 'Strike Fighter Squadron (F/A-18)', scoreBonus: 25 },
  { prefix: 'VRC', name: 'Fleet Logistics (C-2 Greyhound)', scoreBonus: 20 },
  { prefix: 'VQ', name: 'Fleet Air Recon / TACAMO', scoreBonus: 30 },
  { prefix: 'HS', name: 'Helicopter Anti-Submarine Sqn', scoreBonus: 20 },
  { prefix: 'HSC', name: 'Helicopter Sea Combat Sqn (MH-60)', scoreBonus: 20 },
  { prefix: 'HSM', name: 'Helicopter Maritime Strike Sqn', scoreBonus: 20 },

  // Patrol and Recon (North Island / Miramar)
  { prefix: 'VP9', name: 'VP-9 Golden Eagles (P-8A Poseidon)', scoreBonus: 30 },
  { prefix: 'VP', name: 'Patrol Squadron (P-3/P-8)', scoreBonus: 25 },

  // Marine Corps Air Station Miramar
  { prefix: 'VMM', name: 'Marine Medium Tiltrotor (MV-22 Osprey)', scoreBonus: 25 },
  { prefix: 'VMF', name: 'Marine Fighter Squadron', scoreBonus: 25 },
  { prefix: 'VMFA', name: 'Marine Fighter Attack (F/A-18)', scoreBonus: 25 },
  { prefix: 'VMH', name: 'Marine Heavy Helicopter (CH-53)', scoreBonus: 20 },
  { prefix: 'VMGR', name: 'Marine Aerial Refueler Transport (KC-130)', scoreBonus: 25 },

  // Air Mobility / Tankers
  { prefix: 'ARCO', name: 'ARCO aerial refueling tanker', scoreBonus: 30 },
  { prefix: 'RCH', name: 'REACH / Air Mobility Command', scoreBonus: 20 },
  { prefix: 'REACH', name: 'Air Mobility Command', scoreBonus: 20 },

  // ISR / Special Missions
  { prefix: 'ENDRN', name: 'Endurance ISR platform', scoreBonus: 30 },
  { prefix: 'SNTRY', name: 'Sentry AWACS', scoreBonus: 30 },
  { prefix: 'DISCO', name: 'EC-130 Airborne Command Post', scoreBonus: 30 },
  { prefix: 'IRON', name: 'Iron (special operations)', scoreBonus: 20 },
  { prefix: 'KNIFE', name: 'Special Operations Helicopter', scoreBonus: 25 },

  // Training (NAS Lemoore, Pt Mugu, North Island feeders)
  { prefix: 'TOPGUN', name: 'TOPGUN / NAWDC', scoreBonus: 35 },
  { prefix: 'FIGHTROD', name: 'Fighter Weapons School', scoreBonus: 30 },

  // USCG
  { prefix: 'CGAS', name: 'Coast Guard Air Station', scoreBonus: 15 },
]
