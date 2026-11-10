import { tv } from "@/lib/tv"
import { hitBox, hitCoarse, hitX } from "@/lib/hit-area"

export const buttonVariants = tv({
  base: [
    "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-[var(--button-radius,var(--button-corner))] text-sm font-medium",
    "transition duration-fast ease-out",
    "outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ],
  variants: {
    variant: {
      primary: "bg-brand text-brand-foreground shadow-xs hover:bg-brand/90",
      secondary:
        "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80",
      neutral: "bg-foreground text-background shadow-xs hover:bg-foreground/85",
      outline:
        "border border-input bg-transparent shadow-xs hover:bg-accent hover:text-accent-foreground",
      ghost: "hover:bg-accent hover:text-accent-foreground",
      // A ghost that steps back: muted at rest, full ink under the pointer. For the secondary
      // icon actions of a row or a card (remove, edit, more).
      subtle: "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
      overlay:
        "border border-white/15 bg-black/45 text-white shadow-xs hover:bg-black/65 hover:text-white focus-visible:ring-white focus-visible:ring-offset-transparent",
      destructive:
        "bg-destructive/10 text-destructive-strong shadow-xs hover:bg-destructive/20 focus-visible:ring-destructive/40",
      destructiveGhost:
        "text-destructive hover:bg-destructive/10 focus-visible:ring-destructive/40",
      link: "text-primary underline-offset-4 hover:underline",
    },
    size: {
      xs: "h-7 [--button-corner:calc(var(--radius)*0.625)] in-[form:not([data-slot=popover-content]_*)]:rounded-[var(--button-corner)] gap-1 px-2 text-xs has-[>svg]:px-1.5 has-[>[data-slot=button-label]_svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3.5",
      sm: "h-control-sm [--button-corner:var(--radius-md)] in-[form:not([data-slot=popover-content]_*)]:rounded-[var(--button-corner)] gap-1.5 px-3 has-[>svg]:px-2.5 has-[>[data-slot=button-label]_svg]:px-2.5",
      md: "h-control-md [--button-corner:calc(var(--radius)*0.875)] in-[form:not([data-slot=popover-content]_*)]:rounded-[var(--button-corner)] px-4 py-2 has-[>svg]:px-3 has-[>[data-slot=button-label]_svg]:px-3",
      lg: "h-control-lg [--button-corner:var(--radius-lg)] in-[form:not([data-slot=popover-content]_*)]:rounded-[var(--button-corner)] px-5 has-[>svg]:px-4 has-[>[data-slot=button-label]_svg]:px-4",
      xl: "h-control-xl [--button-corner:calc(var(--radius)*1.125)] in-[form:not([data-slot=popover-content]_*)]:rounded-[var(--button-corner)] px-6 text-base has-[>svg]:px-5 has-[>[data-slot=button-label]_svg]:px-5 [&_svg:not([class*='size-'])]:size-5",
    },
    iconOnly: {
      true: "",
      false: "",
    },
    tone: {
      default: "",
      onMedia: "focus-visible:ring-white focus-visible:ring-offset-transparent",
      onInverse: "focus-visible:ring-background focus-visible:ring-offset-transparent",
    },
    touch: {
      true: "[&_svg:not([class*='size-'])]:size-5",
      false: "",
    },
  },
  compoundVariants: [
    { tone: "onMedia", variant: ["primary", "secondary", "neutral"], className: "bg-white text-neutral-950 shadow-xs hover:bg-white/90" },
    { tone: "onMedia", variant: "outline", className: "border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white" },
    { tone: "onMedia", variant: "ghost", className: "text-white hover:bg-white/20 hover:text-white" },
    { tone: "onInverse", variant: ["primary", "secondary", "neutral"], className: "bg-background text-foreground shadow-xs hover:bg-background/90" },
    { tone: "onInverse", variant: "outline", className: "border-background/25 bg-transparent text-background hover:bg-background/10 hover:text-background" },
    { tone: "onInverse", variant: "ghost", className: "text-background hover:bg-background/20 hover:text-background" },
    { size: "xs", iconOnly: true, className: `w-7 gap-0 rounded-[calc(var(--radius)*0.625)] px-0 has-[>svg]:px-0 has-[>[data-slot=button-label]_svg]:px-0 ${hitBox}` },
    // With no label the glyph carries the whole meaning, so sm and md icon-only buttons draw it at 20px.
    { size: "sm", iconOnly: true, className: `w-control-sm gap-0 rounded-md px-0 has-[>svg]:px-0 has-[>[data-slot=button-label]_svg]:px-0 [&_svg:not([class*='size-'])]:size-5 ${hitBox}` },
    { size: "md", iconOnly: true, className: "w-control-md gap-0 rounded-[calc(var(--radius)*0.875)] px-0 has-[>svg]:px-0 has-[>[data-slot=button-label]_svg]:px-0 [&_svg:not([class*='size-'])]:size-5" },
    { size: "lg", iconOnly: true, className: "w-control-lg gap-0 rounded-lg px-0 has-[>svg]:px-0 has-[>[data-slot=button-label]_svg]:px-0" },
    { size: "xl", iconOnly: true, className: "w-control-xl gap-0 rounded-[calc(var(--radius)*1.125)] px-0 has-[>svg]:px-0 has-[>[data-slot=button-label]_svg]:px-0" },

    { size: ["xs", "sm"], iconOnly: false, className: hitX },
    { size: ["md", "lg"], className: hitCoarse },

    { touch: true, tone: "default", variant: "primary", className: "active:bg-brand/90" },
    { touch: true, tone: "default", variant: "secondary", className: "active:bg-secondary/80" },
    { touch: true, tone: "default", variant: "neutral", className: "active:bg-foreground/85" },
    { touch: true, tone: "default", variant: ["outline", "ghost", "subtle"], className: "active:bg-accent active:text-accent-foreground" },
    { touch: true, tone: "default", variant: "overlay", className: "active:bg-black/65" },
    { touch: true, tone: "default", variant: "destructive", className: "active:bg-destructive/20" },
    { touch: true, tone: "default", variant: "destructiveGhost", className: "active:bg-destructive/10" },
  ],
  defaultVariants: {
    variant: "primary",
    size: "md",
    iconOnly: false,
    tone: "default",
    touch: false,
  },
})
