import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, Text } from '@react-three/drei'
import { state, regionWeight, FONT_DISPLAY, FONT_SERIF_ITALIC } from '../../journey.js'

/*
 * A Region is a station of the journey. It renders nothing until the
 * traveller approaches — the fog does the fading, we do the culling.
 */

export function Region({ index, position, spread = 0.62, children }) {
  const ref = useRef()
  useFrame(() => {
    if (ref.current) ref.current.visible = regionWeight(state.offset, index, spread) > 0.02
  })
  return (
    <group ref={ref} position={position} visible={false}>
      {children}
    </group>
  )
}

// Monumental floating text, always facing the traveller.
export function Inscription({
  children, position, size = 1.4, color = '#cfe0ff',
  serif = false, sway = 0, opacity = 0.92, letterSpacing = 0.12,
  fogless = false,
}) {
  const ref = useRef()
  useFrame(({ clock }) => {
    if (ref.current && sway) {
      const t = clock.elapsedTime
      ref.current.position.y = position[1] + Math.sin(t * 0.3 + position[0]) * sway
    }
  })
  return (
    <Billboard ref={ref} position={position}>
      <Text
        font={serif ? FONT_SERIF_ITALIC : FONT_DISPLAY}
        fontSize={size}
        color={color}
        letterSpacing={serif ? 0.02 : letterSpacing}
        anchorX="center"
        anchorY="middle"
        maxWidth={26}
        textAlign="center"
        fillOpacity={opacity}
        material-fog={!fogless}
      >
        {children}
      </Text>
    </Billboard>
  )
}
