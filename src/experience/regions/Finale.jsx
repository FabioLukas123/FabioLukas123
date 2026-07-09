import { Region, Inscription } from './Region.jsx'

/*
 * THE REVEAL
 * The camera rises above the corridor and the far field of the
 * Library materializes to every horizon. What was travelled is
 * one hallway. The rest is implied, forever.
 */

export default function Finale({ position }) {
  return (
    <Region index={8} position={position} spread={0.9}>
      <Inscription position={[0, 16, -78]} size={4.4} color="#e8ecf8" letterSpacing={0.24} opacity={0.95} fogless>
        THE LIBRARY OF HUMANITY
      </Inscription>
      <Inscription position={[0, 9.5, -72]} size={0.95} serif color="#8fa3c8" opacity={0.85} fogless>
        est. before memory — open always
      </Inscription>
    </Region>
  )
}
