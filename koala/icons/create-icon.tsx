import { createElement, useId } from "react"
import type { JSX, Ref, SVGProps } from "react"

export type IconNode = ReadonlyArray<readonly [tag: string, attrs: Readonly<Record<string, string | number>>]>

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "ref"> {
  /** Width and height. A number is pixels; defaults to `1em` so the icon follows the font size. */
  size?: number | string
  /** Icon colour. Without it the icon uses `currentColor`, so `text-*` utilities colour it. */
  color?: string
  /** Accessible name. Without it (or `aria-label`) the icon is decorative and hidden from AT. */
  title?: string
  /**
   * `"fill"` draws the solid version (SPEC.md §13) for selected and status states; icons without
   * fill roles keep their outline. Named like Phosphor's prop, so migrating keeps working: its other
   * weights are accepted and draw the one outline weight.
   */
  weight?: "regular" | "fill" | "bold" | "light" | "thin" | "duotone"
  ref?: Ref<SVGSVGElement>
}

/** SPEC.md §13: element indexes of the outline master by role in the solid version. */
export interface FillRoles {
  solid: readonly number[]
  line?: readonly number[]
  cut?: readonly number[]
  hole?: readonly number[]
}

export type IconComponent = ((props: IconProps) => JSX.Element) & { displayName: string }

const draw = (node: IconNode) => node.map(([tag, attrs], i) => createElement(tag, { key: i, ...attrs }))

// Mask paint per role: white keeps ink, black knocks it out. The dot (the one filled element)
// carries its own fill, so it is painted by fill and never stroked.
const PAINT = {
  solid: { fill: "white", stroke: "white" },
  line: { fill: "none", stroke: "white" },
  cut: { fill: "none", stroke: "black" },
  hole: { fill: "black", stroke: "black" },
} as const

function drawMask(node: IconNode, roles: FillRoles) {
  const roleOf = (i: number): keyof typeof PAINT =>
    roles.solid.includes(i) ? "solid" : roles.cut?.includes(i) ? "cut" : roles.hole?.includes(i) ? "hole" : "line"
  // Knockouts paint last so they cut through every solid shape under them.
  const order = node.map((_, i) => i).sort((a, b) => Number(/cut|hole/.test(roleOf(a))) - Number(/cut|hole/.test(roleOf(b))))
  return order.map((i) => {
    const [tag, attrs] = node[i]
    const paint = PAINT[roleOf(i)]
    const dot = attrs.fill != null
    return createElement(tag, {
      key: i,
      ...attrs,
      fill: dot ? (paint.stroke === "black" ? "black" : "white") : paint.fill,
      stroke: dot ? "none" : paint.stroke,
    })
  })
}

/**
 * Turns a master's element list into a component. No context and no client-only hooks (only
 * useId, for the fill mask), so every icon renders in Server Components as-is. The stroke is set once on the root (SPEC.md §2); pass `strokeWidth`
 * only for a deliberate one-off, the set is drawn for 1.75.
 *
 * `small` is the optional small master (SPEC.md §12). Both drawings ship and `optical.css` shows
 * the one that fits the icon's rendered size; without that stylesheet the large one shows.
 *
 * `fill` holds the roles that derive the solid weight from the outline master (SPEC.md §13): a
 * mask keeps the solid shapes and lines, and knocks out the cuts and holes.
 */
export function createIcon(name: string, node: IconNode, small?: IconNode, fill?: FillRoles): IconComponent {
  function Icon({ size = "1em", color, title, weight = "regular", children, ref, style, ...props }: IconProps) {
    // A mask needs a document-unique id; useId is available in Server Components too.
    const maskId = `ki-${useId().replace(/[^\w-]/g, "")}`
    const solid = weight === "fill" && fill != null
    const labelled = title != null || props["aria-label"] != null || props["aria-labelledby"] != null
    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        // `color`, not `stroke`: the dot primitive is filled with currentColor and must follow too.
        style={color != null ? { ...style, color } : style}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden={labelled ? undefined : true}
        role={labelled ? "img" : undefined}
        data-icon={name}
        {...props}
      >
        {title != null && <title>{title}</title>}
        {solid ? (
          <>
            <defs>
              <mask id={maskId} maskUnits="userSpaceOnUse" x={0} y={0} width={24} height={24}>
                {drawMask(node, fill)}
              </mask>
            </defs>
            <rect width={24} height={24} fill="currentColor" stroke="none" mask={`url(#${maskId})`} />
          </>
        ) : small ? (
          <>
            <g data-optical="large">{draw(node)}</g>
            <g data-optical="small" display="none" strokeWidth={2.25}>
              {draw(small)}
            </g>
          </>
        ) : (
          draw(node)
        )}
        {children}
      </svg>
    )
  }
  Icon.displayName = name.replace(/(^|-)([a-z0-9])/g, (_, __, c: string) => c.toUpperCase())
  return Icon
}
